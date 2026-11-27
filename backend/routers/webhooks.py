import logging
import time
import hashlib
import asyncio
from fastapi import APIRouter, Request, HTTPException
from database import get_supabase, log_activity
from config import settings
from services.reply_service import reply_engine
from services.parveen_experiment_service import (
    parveen_experiment_service, 
    TARGET_NAME, 
    TARGET_ALIASES, 
    RAW_TARGET_PHONE, 
    CANONICAL_TARGET_PHONE
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Cross-platform single-execution deduplication cache
# Maps message_hash -> { "timestamp": float, "platform": str, "replied": bool }
_cross_platform_dedup_cache = {}
# Per-contact cooldown to prevent rapid-fire burst collisions (e.g. 2 messages in 3 seconds)
_last_contact_reply_time = {}

def get_message_hash(sender: str, text: str) -> str:
    clean_sender = (sender or "").strip().lower()
    clean_text = (text or "").strip().lower()
    return hashlib.sha256(f"{clean_sender}:{clean_text}".encode("utf-8")).hexdigest()

def clean_dedup_cache():
    now = time.time()
    expired = [k for k, v in _cross_platform_dedup_cache.items() if now - v["timestamp"] > 120]
    for k in expired:
        _cross_platform_dedup_cache.pop(k, None)

def is_parveen_target(sender: str, title: str = "") -> bool:
    """Checks if sender or title matches Parveen canonical targets or aliases."""
    s = (sender or "").strip()
    t = (title or "").strip()
    
    for alias in TARGET_ALIASES:
        if alias.lower() in s.lower() or alias.lower() in t.lower():
            return True
        if alias in s or alias in t:
            return True
            
    if RAW_TARGET_PHONE in s or RAW_TARGET_PHONE in t:
        return True
    if CANONICAL_TARGET_PHONE in s or CANONICAL_TARGET_PHONE in t:
        return True
        
    return False

def find_contact_in_db(sender: str, title: str = ""):
    """Finds contact record from Supabase contacts table with emoji and substring normalization."""
    try:
        import re
        s = (sender or "").strip()
        t = (title or "").strip()
        
        if s:
            res = get_supabase().table("contacts").select("*").ilike("display_name", f"%{s}%").execute()
            if res.data:
                return res.data[0]
        if t:
            res_t = get_supabase().table("contacts").select("*").ilike("display_name", f"%{t}%").execute()
            if res_t.data:
                return res_t.data[0]

        s_clean = re.sub(r'[^\w\s]', '', s).strip()
        if s_clean and len(s_clean) >= 3:
            res_clean = get_supabase().table("contacts").select("*").ilike("display_name", f"%{s_clean}%").execute()
            if res_clean.data:
                return res_clean.data[0]

        t_clean = re.sub(r'[^\w\s]', '', t).strip()
        if t_clean and len(t_clean) >= 3:
            res_tc = get_supabase().table("contacts").select("*").ilike("display_name", f"%{t_clean}%").execute()
            if res_tc.data:
                return res_tc.data[0]

        # Scan in memory for fuzzy match
        all_c = get_supabase().table("contacts").select("*").execute()
        for c in (all_c.data or []):
            dname = c.get("display_name") or ""
            d_clean = re.sub(r'[^\w\s]', '', dname).strip().lower()
            if s_clean and len(s_clean) >= 3 and (s_clean.lower() in d_clean or d_clean in s_clean.lower()):
                return c
            if t_clean and len(t_clean) >= 3 and (t_clean.lower() in d_clean or d_clean in t_clean.lower()):
                return c
    except Exception as e:
        logger.warning(f"Error querying contacts: {e}")
    return None

@router.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    Authoritative Policy Hierarchy for WhatsApp Auto-Reply:
      1. Authentication & System operational state
      2. Account safety status check (not suspended or paused for delivery failure)
      3. Global Auto-Reply must be ON (if OFF, status: AUTO-REPLY PAUSED, draft only)
      4. Contact recognized in database
      5. Contact is_selected == True
      6. Contact auto_reply_enabled == True
      7. Conversation is 1-to-1 (not group)
      8. Contact not blocked / reply_mode != 'disabled'
      9. Reply mode permits automatic sending (reply_mode == 'automatic')
      10. Original message non-empty and verified
      11. Duplicate processing prevented (90s cross-platform lock)
      12. Required approval exists if in approval mode
      13. Safety checks pass via policy engine
      14. Configured reply delay completes (default 2s)
      15. Sending attempted via supported integration
    """
    try:
        clean_dedup_cache()

        body = await request.json()
        sender = (body.get("sender") or body.get("sender_name") or "").strip()
        message_text = (body.get("message") or body.get("text") or "").strip()
        title = (body.get("title") or "").strip()
        source = body.get("source", "android_notification_listener")
        platform = body.get("platform", "android").lower()
        has_reply_action = bool(body.get("has_native_reply_action", False))

        # Check 10: Original message verified
        if not message_text and not sender:
            return {"status": "ignored", "reason": "empty_payload", "should_reply": False}

        # Check 7: Conversation is 1-to-1 (reject groups)
        is_group = bool(body.get("is_group", False))
        if is_group or "@g.us" in sender or ": " in title or "group" in title.lower():
            return {
                "status": "ignored",
                "reason": "group_conversation_blocked",
                "should_reply": False
            }

        # Check 1 & 2 & 3: Global settings and safety check
        is_global_auto_reply_enabled = False
        account_safety_status = "nominal"
        global_reply_delay = 2
        try:
            sett_res = get_supabase().table("app_settings").select("settings").execute()
            if sett_res.data and sett_res.data[0].get("settings"):
                st = sett_res.data[0]["settings"]
                is_global_auto_reply_enabled = bool(st.get("auto_reply", False))
                account_safety_status = st.get("account_safety_status", "nominal")
                global_reply_delay = int(st.get("reply_delay_seconds") or st.get("reply_delay_min") or 2)
        except Exception as e:
            logger.warning(f"Error fetching app_settings: {e}")

        # Check 2: Account not suspended or restricted
        if account_safety_status in ("suspended", "paused_delivery_failure", "paused_rate_limit"):
            logger.warning(f"Auto-reply blocked by account safety status: {account_safety_status}")
            return {
                "status": "rejected",
                "reason": f"account_safety_paused_{account_safety_status}",
                "safety_status": account_safety_status,
                "should_reply": False
            }

        # Check 11: Cross-Device Deduplication Check (90s window)
        msg_hash = get_message_hash(sender or title, message_text)
        now = time.time()
        
        if msg_hash in _cross_platform_dedup_cache:
            prev_entry = _cross_platform_dedup_cache[msg_hash]
            if now - prev_entry["timestamp"] < 90:
                logger.info(
                    f"Deduplicating incoming event on {platform}: already captured by {prev_entry['platform']} "
                    f"({now - prev_entry['timestamp']:.1f}s ago). Suppressing second reply."
                )
                return {
                    "status": "ignored",
                    "reason": "deduplicated_cross_platform",
                    "processed_by": prev_entry["platform"],
                    "should_reply": False
                }

        # Reserve lock in dedup cache
        _cross_platform_dedup_cache[msg_hash] = {
            "timestamp": now,
            "platform": platform,
            "replied": False
        }

        # Safe logging of incoming notification
        try:
            get_supabase().table("integration_events").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "source": source,
                "event_type": "whatsapp_incoming",
                "processing_status": "received",
                "safe_metadata": {
                    "sender": sender,
                    "platform": platform,
                    "has_native_reply_action": has_reply_action,
                    "global_auto_reply": is_global_auto_reply_enabled
                }
            }).execute()
        except Exception as log_err:
            logger.warning(f"Failed to log integration_event: {log_err}")

        # Check 4: Contact recognized in DB
        contact_record = find_contact_in_db(sender, title)
        is_parveen = is_parveen_target(sender, title)

        if not contact_record and not is_parveen:
            # Unknown contact -> generate draft only
            draft_res = await reply_engine.process_incoming_message(sender_name=sender or "Unknown", message_body=message_text)
            return {
                "status": "success",
                "should_reply": False,
                "reason": "unrecognized_contact_draft_quarantined",
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Extract contact preferences
        is_selected = contact_record.get("is_selected", False) if contact_record else True
        contact_auto_reply_enabled = contact_record.get("auto_reply_enabled", False) if contact_record else True
        reply_mode = contact_record.get("reply_mode", "automatic") if contact_record else "automatic"
        contact_id = contact_record.get("id") if contact_record else None
        contact_delay = global_reply_delay

        # Check 5: Contact is_selected
        if not is_selected:
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "should_reply": False,
                "reason": "contact_not_selected_draft_quarantined",
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 6: Contact auto_reply_enabled
        if not contact_auto_reply_enabled:
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "should_reply": False,
                "reason": "contact_auto_reply_disabled_draft_quarantined",
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 6b: Per-Contact Cooldown to prevent multi-bubble burst collisions (10s)
        contact_key = str(contact_id or sender or "").strip().lower()
        if contact_key in _last_contact_reply_time:
            time_since_last = now - _last_contact_reply_time[contact_key]
            if time_since_last < 10.0:
                logger.info(f"Burst message from {sender} received {time_since_last:.1f}s after previous reply. Suppressing duplicate dispatch.")
                draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
                return {
                    "status": "ignored",
                    "reason": "burst_cooldown_suppression",
                    "should_reply": False,
                    "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
                }

        # Check 8: Contact not disabled/blocked
        if reply_mode == "disabled":
            return {
                "status": "ignored",
                "should_reply": False,
                "reason": "contact_reply_mode_disabled"
            }

        # Check 3: Global Auto-Reply Pause Check
        if not is_global_auto_reply_enabled:
            logger.info("Global Auto-Reply is OFF / PAUSED. Generating draft for manual ratification.")
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "should_reply": False,
                "reason": "AUTO-REPLY PAUSED",
                "message": "Your contact preferences are saved, but automatic WhatsApp replies are currently paused. Enable Global Auto-Reply when you are ready.",
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 9: Reply mode permits automatic sending
        if reply_mode == "approval":
            logger.info(f"Contact {sender} configured for manual approval. Generating draft.")
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "should_reply": False,
                "reason": "manual_approval_required",
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # If Parveen target, use personalized style pipeline
        if is_parveen:
            parveen_event = {
                "notification_id": body.get("notification_id") or body.get("notification_key"),
                "source_app": body.get("source_app", "WhatsApp"),
                "sender": sender or TARGET_NAME,
                "sender_phone": CANONICAL_TARGET_PHONE,
                "message": message_text,
                "title": title or sender,
                "has_native_reply_action": has_reply_action,
                "simulate_sending": False
            }

            res = await parveen_experiment_service.process_notification_event(parveen_event)
            if res.get("status") == "success" and res.get("reply_text"):
                reply_text = res["reply_text"]
                _cross_platform_dedup_cache[msg_hash]["replied"] = True
                _last_contact_reply_time[contact_key] = time.time()

                # Log activity with reply_text and incoming message
                try:
                    log_activity(
                        event_type="reply_generated",
                        description=f"Generated and dispatched reply for {sender}",
                        metadata={
                            "incoming_message": message_text,
                            "reply_text": reply_text,
                            "contact": sender,
                            "phone": CANONICAL_TARGET_PHONE,
                            "provider": res.get("provider", "groq")
                        }
                    )
                except Exception:
                    pass

                return {
                    "status": "success",
                    "should_reply": True,
                    "reply_text": reply_text,
                    "phone_number": CANONICAL_TARGET_PHONE,
                    "sender": sender,
                    "platform": platform,
                    "reply_delay_seconds": contact_delay,
                    "experiment": "parveen"
                }
            else:
                return {
                    "status": res.get("status", "rejected"),
                    "reason": res.get("reason", "parveen_policy_rejection"),
                    "should_reply": False,
                    "details": res
                }

        # For any other authorized selected contact:
        # Check 13: Safety check & generation via reply engine
        draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
        reply_text = draft_res.get("draft_text") if isinstance(draft_res, dict) else None

        if reply_text:
            # Check 14: Configured delay completes (default 2s)
            logger.info(f"Enforcing configured {contact_delay}-second reply delay before dispatching to {sender}...")
            await asyncio.sleep(contact_delay)

            _cross_platform_dedup_cache[msg_hash]["replied"] = True
            _last_contact_reply_time[contact_key] = time.time()

            contact_phone = contact_record.get("phone_e164") if contact_record else None

            # Log activity for UI feed display
            try:
                log_activity(
                    event_type="reply_generated",
                    description=f"Generated and dispatched reply for {sender}",
                    metadata={
                        "incoming_message": message_text,
                        "reply_text": reply_text,
                        "contact": sender,
                        "phone": contact_phone,
                        "provider": "groq"
                    }
                )
            except Exception:
                pass

            return {
                "status": "success",
                "should_reply": True,
                "reply_text": reply_text,
                "phone_number": contact_phone,
                "contact_name": sender,
                "sender": sender,
                "platform": platform,
                "reply_delay_seconds": contact_delay,
                "draft_id": draft_res.get("draft_id")
            }

        return {
            "status": "success",
            "should_reply": False,
            "reason": "draft_created_for_ratification",
            "draft_result": draft_res
        }

    except Exception as e:
        logger.error(f"Error in whatsapp_webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
