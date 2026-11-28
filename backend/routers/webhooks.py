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

def _normalize_text(val: str) -> str:
    """Normalize unicode, strip emojis/punctuation, collapse spaces, and lowercase."""
    import re, unicodedata
    if not val:
        return ""
    s = unicodedata.normalize("NFKC", val)
    s = re.sub(r"[^\w\s+]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip().casefold()
    return s

def _normalize_phone(val: str) -> str:
    """Extract digits with leading + if E.164-like."""
    import re
    if not val:
        return ""
    digits = re.sub(r"\D", "", val)
    if len(digits) < 7:
        return ""
    return f"+{digits}"

def find_contact_in_db(sender: str, title: str = "", sender_phone: str = ""):
    """
    Safe contact matching in strict priority order:
      1. Verified/provided phone number (exact normalized E.164 or last-10 digits)
      2. Exact normalized display_name match
      3. Controlled alias match (Parveen / مومياء)
    Returns (contact_dict_or_none, status_reason_or_none).
    Never guesses when multiple distinct contacts match.
    """
    try:
        sb = get_supabase()
        all_c = sb.table("contacts").select("*").execute().data or []

        # 1. Phone match (from explicit sender_phone or phone-formatted sender)
        phone_cand = _normalize_phone(sender_phone) or (_normalize_phone(sender) if any(ch.isdigit() for ch in (sender or "")) else "")
        if phone_cand:
            phone_matches = []
            cand_last10 = phone_cand[-10:]
            for c in all_c:
                c_phone = _normalize_phone(c.get("phone_e164") or "")
                if c_phone and (c_phone == phone_cand or (len(cand_last10) == 10 and c_phone.endswith(cand_last10))):
                    phone_matches.append(c)
            if len(phone_matches) == 1:
                return phone_matches[0], None
            if len(phone_matches) > 1:
                # Prefer exact E.164 match if unique
                exact_p = [c for c in phone_matches if _normalize_phone(c.get("phone_e164") or "") == phone_cand]
                if len(exact_p) == 1:
                    return exact_p[0], None
                return None, "ambiguous_contact"

        # 2. Exact normalized display_name match
        norm_candidates = [n for n in (_normalize_text(sender), _normalize_text(title)) if n]
        for norm_target in norm_candidates:
            exact_matches = [c for c in all_c if _normalize_text(c.get("display_name") or "") == norm_target]
            if len(exact_matches) == 1:
                return exact_matches[0], None
            if len(exact_matches) > 1:
                return None, "ambiguous_contact"

        # 3. Controlled alias match (Parveen canonical aliases)
        if is_parveen_target(sender, title):
            parveen_matches = [c for c in all_c if is_parveen_target(c.get("display_name") or "", "")]
            if len(parveen_matches) == 1:
                return parveen_matches[0], None
            # Prefer canonical 'Parveen' record if both Parveen and Arabic alias exist
            canonical = [c for c in parveen_matches if (c.get("display_name") or "").strip().lower() == "parveen"]
            if len(canonical) == 1:
                return canonical[0], None
            if parveen_matches:
                return None, "ambiguous_contact"

        return None, "contact_not_found"
    except Exception as e:
        logger.warning(f"Error querying contacts: {e}")
        return None, "contact_lookup_error"

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

        # Check 10b: Strictly ignore outgoing messages from self
        # Covers: "You", "Me", WhatsApp self-label, operator display names (ASCII + Unicode small-caps),
        # and payloads that explicitly declare direction=outgoing
        import unicodedata
        def _ascii_fold(s: str) -> str:
            """Fold Unicode to nearest ASCII equivalent for comparison."""
            try:
                return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").strip().lower()
            except Exception:
                return s.strip().lower()

        # Explicit direction flag from Android (most reliable)
        direction_field = str(body.get("direction", "")).strip().lower()
        if direction_field == "outgoing":
            logger.info(f"Ignoring outgoing message (direction=outgoing) from {sender}")
            return {"status": "ignored", "reason": "outgoing_message_from_self", "should_reply": False}

        clean_sender_lower = sender.strip().lower()
        folded_sender = _ascii_fold(sender)
        # Block literal self labels and all known operator name variants
        SELF_NAMES = {"you", "me", "self"}
        OWNER_NAMES = {"thoufikur", "thoufikur rahman", "thoufikur rahaman",
                       "thoufikur rahaman y", "thoufikur rahman y"}
        if clean_sender_lower in SELF_NAMES or folded_sender in OWNER_NAMES:
            logger.info(f"Ignoring outgoing message from self ({sender}): '{message_text}'")
            return {
                "status": "ignored",
                "reason": "outgoing_message_from_self",
                "should_reply": False
            }
        # Also block partial matches for the owner's name in folded form
        if any(name in folded_sender for name in ("thoufikur",)):
            logger.info(f"Ignoring outgoing message from self (name contains owner prefix) ({sender})")
            return {
                "status": "ignored",
                "reason": "outgoing_message_from_self",
                "should_reply": False
            }

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

        # Check 11: Durable Idempotency & Cross-Device Deduplication
        import uuid
        correlation_id = str(body.get("correlation_id") or uuid.uuid4())
        event_id = str(body.get("event_id") or "").strip()
        if not event_id:
            notif_key = str(body.get("notification_key") or body.get("notification_id") or "").strip()
            post_ts = str(body.get("post_time") or body.get("timestamp") or "").strip()
            if notif_key and post_ts:
                event_id = f"{notif_key}:{post_ts}"

        is_test_mode = bool(body.get("test_mode", False))
        now = time.time()

        # Durable DB-backed deduplication using event_id when available
        if event_id and not is_test_mode:
            try:
                dup_res = get_supabase().table("integration_events")\
                    .select("id, processing_status")\
                    .contains("safe_metadata", {"event_id": event_id})\
                    .limit(1)\
                    .execute()
                if dup_res.data:
                    logger.info(f"Durable dedup hit for event_id={event_id}")
                    return {
                        "status": "ignored",
                        "pipeline_status": "policy_rejected",
                        "reason": "duplicate_event",
                        "correlation_id": correlation_id,
                        "should_reply": False
                    }
            except Exception as dup_err:
                logger.warning(f"Durable dedup check note: {dup_err}")

        # In-memory short-window fallback only when no stable event_id exists
        dedup_key = event_id or get_message_hash(sender or title, message_text)
        if not is_test_mode and dedup_key in _cross_platform_dedup_cache:
            prev_entry = _cross_platform_dedup_cache[dedup_key]
            if now - prev_entry["timestamp"] < (300 if event_id else 25):
                return {
                    "status": "ignored",
                    "pipeline_status": "policy_rejected",
                    "reason": "deduplicated_cross_platform",
                    "processed_by": prev_entry["platform"],
                    "correlation_id": correlation_id,
                    "should_reply": False
                }

        if not is_test_mode:
            _cross_platform_dedup_cache[dedup_key] = {
                "timestamp": now,
                "platform": platform,
                "replied": False
            }

        # Safe logging of incoming notification (no private message body stored here)
        try:
            get_supabase().table("integration_events").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "source": source,
                "event_type": "whatsapp_test" if is_test_mode else "whatsapp_incoming",
                "processing_status": "received",
                "safe_metadata": {
                    "correlation_id": correlation_id,
                    "pipeline_status": "backend_received",
                    "event_id": event_id or dedup_key,
                    "platform": platform,
                    "has_native_reply_action": has_reply_action,
                    "global_auto_reply": is_global_auto_reply_enabled,
                    "test_mode": is_test_mode
                }
            }).execute()
        except Exception as log_err:
            logger.warning(f"Failed to log integration_event: {log_err}")

        # Check 4: Contact recognized in DB (strict safe matching)
        sender_phone = (body.get("sender_phone") or "").strip()
        contact_record, match_reason = find_contact_in_db(sender, title, sender_phone)
        is_parveen = is_parveen_target(sender, title)

        if not contact_record:
            reason_code = match_reason or "contact_not_found"
            if is_test_mode:
                return {
                    "status": "rejected",
                    "pipeline_status": "policy_rejected",
                    "reason": reason_code,
                    "correlation_id": correlation_id,
                    "should_reply": False
                }
            draft_res = await reply_engine.process_incoming_message(sender_name=sender or "Unknown", message_body=message_text)
            return {
                "status": "success",
                "pipeline_status": "draft_created",
                "should_reply": False,
                "reason": reason_code,
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Extract contact preferences (never auto-enable)
        is_selected = bool(contact_record.get("is_selected", False))
        contact_auto_reply_enabled = bool(contact_record.get("auto_reply_enabled", False))
        reply_mode = contact_record.get("reply_mode", "approval")
        contact_id = contact_record.get("id")
        contact_delay = global_reply_delay

        # Check 5: Contact is_selected
        if not is_selected:
            if is_test_mode:
                return {"status": "rejected", "pipeline_status": "policy_rejected", "reason": "contact_not_selected", "correlation_id": correlation_id, "should_reply": False}
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "pipeline_status": "draft_created",
                "should_reply": False,
                "reason": "contact_not_selected",
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 6: Contact auto_reply_enabled
        if not contact_auto_reply_enabled:
            if is_test_mode:
                return {"status": "rejected", "pipeline_status": "policy_rejected", "reason": "contact_auto_reply_disabled", "correlation_id": correlation_id, "should_reply": False}
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "pipeline_status": "draft_created",
                "should_reply": False,
                "reason": "contact_auto_reply_disabled",
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 6b: Per-Contact Cooldown to prevent multi-bubble burst collisions (10s)
        contact_key = str(contact_id or sender or "").strip().lower()
        if not is_test_mode and contact_key in _last_contact_reply_time:
            time_since_last = now - _last_contact_reply_time[contact_key]
            if time_since_last < 10.0:
                logger.info(f"Burst message from {sender} received {time_since_last:.1f}s after previous reply. Suppressing duplicate dispatch.")
                draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
                return {
                    "status": "ignored",
                    "pipeline_status": "policy_rejected",
                    "reason": "burst_cooldown_suppression",
                    "correlation_id": correlation_id,
                    "should_reply": False,
                    "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
                }

        # Check 8: Contact not disabled/blocked
        if reply_mode == "disabled":
            return {
                "status": "ignored",
                "pipeline_status": "policy_rejected",
                "should_reply": False,
                "reason": "contact_reply_mode_disabled",
                "correlation_id": correlation_id
            }

        # Check 3: Global Auto-Reply Pause Check
        if not is_global_auto_reply_enabled:
            logger.info("Global Auto-Reply is OFF / PAUSED. Generating draft for manual ratification.")
            if is_test_mode:
                return {"status": "rejected", "pipeline_status": "policy_rejected", "reason": "global_auto_reply_disabled", "correlation_id": correlation_id, "should_reply": False}
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "pipeline_status": "draft_created",
                "should_reply": False,
                "reason": "global_auto_reply_disabled",
                "message": "Your contact preferences are saved, but automatic WhatsApp replies are currently paused. Enable Global Auto-Reply when you are ready.",
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 9: Reply mode permits automatic sending
        if reply_mode == "approval":
            logger.info(f"Contact {sender} configured for manual approval. Generating draft.")
            if is_test_mode:
                return {"status": "rejected", "pipeline_status": "policy_rejected", "reason": "manual_approval_required", "correlation_id": correlation_id, "should_reply": False}
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "pipeline_status": "draft_created",
                "should_reply": False,
                "reason": "manual_approval_required",
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        # Check 11b: Android requires a usable RemoteInput action for automatic direct reply
        if platform == "android" and not has_reply_action and not is_test_mode:
            draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
            return {
                "status": "success",
                "pipeline_status": "reply_action_unavailable",
                "should_reply": False,
                "reason": "reply_action_unavailable",
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id") if isinstance(draft_res, dict) else None
            }

        if is_test_mode:
            return {
                "status": "success",
                "pipeline_status": "reply_generated",
                "should_reply": False,
                "reason": "test_mode_verified",
                "reply_text": "[TEST MODE] Pipeline verified — automatic reply would dispatch.",
                "correlation_id": correlation_id
            }

        # Unified Context-Aware Generation via Reply Engine for all authorized contacts
        # Check 13: Safety check & generation via reply engine
        draft_res = await reply_engine.process_incoming_message(contact_id=contact_id, sender_name=sender, message_body=message_text)
        
        # Check if generation failed
        if isinstance(draft_res, dict) and not draft_res.get("success", False):
            logger.warning(f"AI reply generation failed for {sender}: {draft_res.get('error')}")
            return {
                "status": "failed",
                "pipeline_status": "generation_failed",
                "should_reply": False,
                "reason": draft_res.get("error", "generation_failed"),
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id")
            }

        # Check if important decision requires manual operator ratification (dates, bookings, money, commitments)
        if isinstance(draft_res, dict) and draft_res.get("requires_approval"):
            logger.info(f"Important decision detected for {sender}. Holding draft for operator ratification.")
            return {
                "status": "held",
                "pipeline_status": "awaiting_approval",
                "should_reply": False,
                "reason": "important_decision_requires_approval",
                "correlation_id": correlation_id,
                "draft_id": draft_res.get("draft_id"),
                "draft_text": draft_res.get("draft_text")
            }

        reply_text = draft_res.get("draft_text") if isinstance(draft_res, dict) else None

        if reply_text:
            # Check 14: Configured delay completes (default 2s)
            logger.info(f"Enforcing configured {contact_delay}-second reply delay before dispatching to {sender}...")
            await asyncio.sleep(contact_delay)

            if dedup_key in _cross_platform_dedup_cache:
                _cross_platform_dedup_cache[dedup_key]["replied"] = True
            _last_contact_reply_time[contact_key] = time.time()

            contact_phone = contact_record.get("phone_e164") if contact_record else (CANONICAL_TARGET_PHONE if is_parveen else None)

            # Persist outgoing reply message to ensure unbroken conversation flow
            convo_id = draft_res.get("conversation_id")
            if convo_id:
                try:
                    get_supabase().table("messages").insert({
                        "owner_id": settings.DEFAULT_OWNER_ID,
                        "conversation_id": convo_id,
                        "direction": "outgoing",
                        "sender_name": "Thoufikur Rahman",
                        "body": reply_text,
                        "source": "auto_reply"
                    }).execute()
                    logger.info(f"Persisted dispatched outgoing reply in conversation {convo_id}")
                except Exception as save_err:
                    logger.warning(f"Failed to persist outgoing message: {save_err}")

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
                        "provider": draft_res.get("provider", "groq")
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
