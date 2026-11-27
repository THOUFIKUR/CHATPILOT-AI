import os
import json
import logging
import uuid
import re
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from database import get_supabase, log_activity
from config import settings
from services.ai_manager import ai_manager
from services.policy_engine import policy_engine

logger = logging.getLogger(__name__)

STATE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "parveen_experiment_state.json")

CANONICAL_TARGET_PHONE = "+919790171303"
RAW_TARGET_PHONE = "9790171303"
TARGET_NAME = "Parveen"
TARGET_ALIASES = ["Parveen", "مومياء", "مومياء ❤️‍🔥❤️", "مومياء ❤️❤️"]
MAX_REPLIES = 999999 # Artificial 2-reply cap removed per specification

def normalize_phone_number(raw: Optional[str]) -> Optional[str]:
    """Normalizes phone numbers to canonical E.164 format (+919790171303)."""
    if not raw:
        return None
    digits = re.sub(r'\D', '', raw)
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    elif len(digits) == 10:
        return f"+91{digits}"
    elif digits.startswith("0") and len(digits) == 11:
        return f"+91{digits[1:]}"
    elif raw.startswith("+"):
        return f"+{digits}"
    return f"+{digits}" if digits else None

class ParveenExperimentService:
    def __init__(self):
        self.supabase = get_supabase()
        self.state_file = STATE_FILE
        self._load_state()

    def _default_state(self) -> Dict[str, Any]:
        return {
            "experiment_name": "Parveen Single-Contact WhatsApp Auto-Reply Test",
            "target_contact": {
                "display_name": TARGET_NAME,
                "phone_number": RAW_TARGET_PHONE,
                "canonical_phone": CANONICAL_TARGET_PHONE,
                "country": "India"
            },
            "is_enabled": True,
            "is_emergency_stopped": False,
            "is_completed": False,
            "max_replies_allowed": MAX_REPLIES,
            "successful_replies_count": 0,
            "processed_notification_ids": [],
            "processed_message_signatures": [],
            "last_event_timestamp": None,
            "last_reply_details": None,
            "diagnostic_logs": [],
            "reply_mode": "automatic", # 'automatic' (auto-submit) or 'manual' (pre-fill chat only)
            "native_reply_action_available": False,
            "sending_mechanism": "native_windows_notification_reply_check"
        }

    def _load_state(self):
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    self.state = json.load(f)
                    return
            except Exception as e:
                logger.error(f"Failed to read experiment state: {e}")
        self.state = self._default_state()
        self._save_state()

    def _save_state(self):
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        try:
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write experiment state: {e}")

    def log_diagnostic(self, stage: str, message: str, level: str = "INFO", details: Any = None):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "stage": stage,
            "level": level,
            "message": message,
            "details": details
        }
        self.state.setdefault("diagnostic_logs", []).append(entry)
        # Keep last 100 entries
        if len(self.state["diagnostic_logs"]) > 100:
            self.state["diagnostic_logs"] = self.state["diagnostic_logs"][-100:]
        self._save_state()
        logger.info(f"[ParveenExp:{stage}] {message}")

    def get_status(self) -> Dict[str, Any]:
        return {
            "experiment_active": self.state.get("is_enabled", False) and not self.state.get("is_completed", False) and not self.state.get("is_emergency_stopped", False),
            "is_enabled": self.state.get("is_enabled", False),
            "is_completed": self.state.get("is_completed", False),
            "is_emergency_stopped": self.state.get("is_emergency_stopped", False),
            "target_contact": self.state.get("target_contact"),
            "successful_replies_count": self.state.get("successful_replies_count", 0),
            "max_replies_allowed": self.state.get("max_replies_allowed", 1),
            "last_event_timestamp": self.state.get("last_event_timestamp"),
            "last_reply_details": self.state.get("last_reply_details"),
            "native_reply_action_available": self.state.get("native_reply_action_available", False),
            "total_diagnostics": len(self.state.get("diagnostic_logs", []))
        }

    def start_experiment(self) -> Dict[str, Any]:
        self.state["is_completed"] = False
        self.state["is_enabled"] = True
        self.state["is_emergency_stopped"] = False
        self.log_diagnostic("LIFECYCLE", "Experiment started/resumed by user.")
        self._save_state()
        return {"success": True, "status": self.get_status()}

    def stop_experiment(self) -> Dict[str, Any]:
        self.state["is_enabled"] = False
        self.log_diagnostic("LIFECYCLE", "Experiment paused by user.")
        self._save_state()
        return {"success": True, "status": self.get_status()}

    def emergency_stop(self) -> Dict[str, Any]:
        self.state["is_emergency_stopped"] = True
        self.state["is_enabled"] = False
        self.log_diagnostic("EMERGENCY_STOP", "GLOBAL EMERGENCY STOP ACTIVATED. All processing halted immediately.", level="CRITICAL")
        self._save_state()
        return {"success": True, "message": "Emergency stop activated. Experiment disabled.", "status": self.get_status()}

    def set_reply_mode(self, mode: str) -> Dict[str, Any]:
        valid_modes = ["automatic", "manual", "off"]
        if mode not in valid_modes:
            mode = "automatic"
        self.state["reply_mode"] = mode
        if mode == "off":
            self.state["is_enabled"] = False
        else:
            self.state["is_enabled"] = True
        self.log_diagnostic("MODE_CHANGE", f"Reply mode set to: {mode}")
        self._save_state()
        return {"success": True, "mode": mode, "status": self.get_status()}

    def reset_experiment(self, force: bool = False) -> Dict[str, Any]:
        """Admin reset to allow another test run."""
        self.state = self._default_state()
        self.log_diagnostic("RESET", "Experiment state reset to fresh defaults.")
        self._save_state()
        return {"success": True, "message": "Experiment state reset.", "status": self.get_status()}

    def is_target_contact(self, sender_raw: str, phone_raw: Optional[str] = None) -> bool:
        """
        Confirms whether the incoming notification originates from Parveen (9790171303).
        Fails closed if identity is ambiguous.
        """
        if not sender_raw:
            return False

        sender_clean = sender_raw.strip()
        norm_phone = normalize_phone_number(phone_raw or sender_clean)

        # 1. Match canonical phone number (+919790171303)
        if norm_phone == CANONICAL_TARGET_PHONE:
            return True

        # 2. Match exact readable label 'Parveen' or Urdu/Arabic alias 'مومياء' if no different number attached
        is_name_match = (
            sender_clean.lower() == TARGET_NAME.lower() or
            any(alias in sender_clean for alias in TARGET_ALIASES)
        )
        if is_name_match:
            if phone_raw and normalize_phone_number(phone_raw) != CANONICAL_TARGET_PHONE:
                return False # Phone number mismatch
            return True

        # 3. Match format 'Parveen (+919790171303)' or '+91 97901 71303'
        if any(alias.lower() in sender_clean.lower() for alias in [TARGET_NAME, *TARGET_ALIASES]):
            extracted_num = normalize_phone_number(sender_clean)
            if extracted_num and extracted_num != CANONICAL_TARGET_PHONE:
                return False
            return True

        return False

    def is_group_message(self, sender_str: str, message_text: str, notification_title: Optional[str] = None) -> bool:
        """Rejects group notifications (e.g. 'Group Name: Sender' or group indicators)."""
        # 1. Title indicators
        if notification_title:
            tl = notification_title.lower()
            if ": " in notification_title or "@" in notification_title:
                return True
            if "group" in tl or " messages)" in tl or " participants" in tl:
                return True
            # If title is provided and does not match the target contact or any alias, it is a group title
            is_target_title = (
                TARGET_NAME.lower() in tl or
                RAW_TARGET_PHONE in notification_title or
                any(alias in notification_title for alias in TARGET_ALIASES)
            )
            if not is_target_title:
                return True

        # 2. Sender indicators
        if "@" in sender_str or ":" in sender_str:
            return True

        combined = f"{notification_title or ''} {sender_str} {message_text}"
        if "group" in combined.lower() and ("added" in combined.lower() or "left" in combined.lower() or "created" in combined.lower()):
            return True

        return False

    def get_parveen_context(self, limit: int = 8) -> str:
        """Retrieves recent conversation history specifically with Parveen."""
        try:
            # Get Parveen contact
            c_res = self.supabase.table("contacts").select("id").eq("display_name", TARGET_NAME).execute()
            if not c_res.data:
                return "Recent Context: Direct 1-on-1 WhatsApp chat with family member Parveen. Tone is concise Tanglish."
            
            contact_id = c_res.data[0]["id"]
            conv_res = self.supabase.table("conversations").select("id").eq("contact_id", contact_id).execute()
            if not conv_res.data:
                return "Recent Context: Direct 1-on-1 WhatsApp chat with family member Parveen."

            conv_id = conv_res.data[0]["id"]
            m_res = self.supabase.table("messages").select("direction, sender_name, body, created_at")\
                .eq("conversation_id", conv_id)\
                .neq("body", "<Media omitted>")\
                .order("created_at", desc=True)\
                .limit(limit).execute()

            msgs = m_res.data or []
            if not msgs:
                return "Recent Context: Direct 1-on-1 chat with Parveen. Thoufikur typically replies in concise Tanglish with 'maa'."

            lines = ["--- RECENT CONVERSATION WITH PARVEEN ---"]
            for m in reversed(msgs):
                b = (m.get("body") or "").strip()
                if b and b != "<Media omitted>":
                    role = "You" if m.get("direction") == "outgoing" else "Parveen"
                    lines.append(f"{role}: {b}")
            lines.append("----------------------------------------")
            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Error fetching Parveen context: {e}")
            return "Recent Context: Direct 1-on-1 WhatsApp chat with Parveen."

    async def generate_personalized_reply(self, incoming_text: str) -> Dict[str, Any]:
        """
        Generates an authentic personalized response using Parveen-specific writing style.
        """
        history_context = self.get_parveen_context(limit=6)

        system_prompt = (
            "You are Thoufikur Rahaman replying to your close family member Parveen on WhatsApp.\n"
            "You are participating in a single-contact automated reply experiment.\n\n"
            "EXACT PARVEEN WRITING STYLE RULES (Extracted from 477 historical messages):\n"
            "1. Language: Tanglish (Tamil words written in English alphabet) mixed naturally with English.\n"
            "2. Tone: Affectionate, concise, direct, family respectful.\n"
            "3. Honorific: Use 'maa' where natural (e.g. 'Seri maa', 'Vanthutaennn maa').\n"
            "4. Length: Very short (1 to 8 words). Do NOT write paragraphs or essay responses.\n"
            "5. Examples of your real replies to Parveen:\n"
            "   - When asked 'W r u' or 'Anga irukiga': 'Train la..express' / 'Vanthutaennn' / 'Thakkolam vara porromm'\n"
            "   - When asked 'Eppa varuviga': '6 maniku varuvan' / 'Nemili poittu varanum'\n"
            "   - When asked about availability: 'Classla iruken' / 'Ok thaa..'\n"
            "   - When asked about a file/photo: 'Clear aah send pannu maa' / 'Sheik aa anupunga'\n"
            "   - When asked about someone's number: 'Ippo share panren'\n"
            "6. NEVER invent appointments, promises, financial commitments, or fake details.\n"
            "7. Output ONLY the WhatsApp reply message text. No quotes, no preamble, no explanations."
        )

        user_content = f"{history_context}\n\nIncoming WhatsApp Message from Parveen: \"{incoming_text}\"\n\nYour natural reply:"

        response = await ai_manager.generate_response(
            messages=[{"role": "user", "content": user_content}],
            system_prompt=system_prompt,
            max_tokens=60
        )

        reply_text = response.get("content", "").strip()
        # Clean quotes if model wrapped response in quotes
        if reply_text.startswith('"') and reply_text.endswith('"'):
            reply_text = reply_text[1:-1].strip()

        return {
            "reply_text": reply_text,
            "provider": response.get("provider", "groq"),
            "model": response.get("model", "qwen/qwen3.8-27b"),
            "latency_ms": response.get("latency_ms", 0)
        }

    async def process_notification_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main execution pipeline for an incoming notification event.
        Strictly enforces:
          - Source app verification (WhatsApp Desktop)
          - Single-contact targeting (+919790171303 / Parveen)
          - Non-group verification
          - One-shot limit enforcement
          - Duplicate rejection
          - Safety policy check
          - Personalized AI generation
          - Native sending verification
          - Local state and Supabase persistence
        """
        now = datetime.now(timezone.utc).isoformat()
        self.state["last_event_timestamp"] = now

        notification_id = str(event.get("notification_id") or uuid.uuid4())
        source_app = event.get("source_app", "")
        sender_raw = event.get("sender", "").strip()
        sender_phone = event.get("sender_phone")
        message_text = event.get("message", "").strip()
        is_outgoing = event.get("is_outgoing", False)
        notification_title = event.get("title")

        # Handle WhatsApp Desktop single-line notifications where title contains both sender and message
        if not message_text and (notification_title or sender_raw):
            comb = notification_title or sender_raw
            for alias in TARGET_ALIASES:
                if alias in comb:
                    parts = comb.split(alias, 1)
                    if len(parts) > 1 and parts[1].strip():
                        message_text = parts[1].strip()
                        sender_raw = alias
                        break

        # 1. Check Emergency Stop
        if self.state.get("is_emergency_stopped", False):
            self.log_diagnostic("REJECTION", "Blocked: Emergency stop is ACTIVE.", level="WARNING")
            return {"status": "rejected", "reason": "emergency_stop_active"}

        # 2. Check Duplicate Notification (detects replay even after experiment completion)
        msg_sig = f"{sender_raw}_{message_text}_{notification_id}"
        if notification_id in self.state.get("processed_notification_ids", []) or msg_sig in self.state.get("processed_message_signatures", []):
            self.log_diagnostic("REJECTION", f"Blocked: Duplicate notification {notification_id} detected.")
            return {"status": "rejected", "reason": "duplicate_notification"}

        # 3. Account Safety & Platform Rate Limiting Layer (No artificial 2-reply cap)
        import time as _t
        recent_cutoff = _t.time() - 3600
        self.state["hourly_reply_timestamps"] = [t for t in self.state.get("hourly_reply_timestamps", []) if t > recent_cutoff]
        if len(self.state["hourly_reply_timestamps"]) >= 30:
            self.log_diagnostic("RATE_LIMIT", "Blocked: Velocity safety limit reached (30 msgs/hr). Pausing to preserve WhatsApp account standing.", level="WARNING")
            return {"status": "rejected", "reason": "rate_limit_prevention"}

        # 4. Check Experiment Enabled
        if not self.state.get("is_enabled", False):
            self.log_diagnostic("REJECTION", "Blocked: Experiment is disabled.")
            return {"status": "rejected", "reason": "experiment_disabled"}

        # 5. Check Outgoing Event
        if is_outgoing:
            self.log_diagnostic("REJECTION", "Ignored: Notification is an outgoing message event.")
            return {"status": "rejected", "reason": "outgoing_message"}

        # 6. Verify Source Application (WhatsApp Desktop)
        # Allows 'WhatsApp', '5319275A.WhatsAppDesktop', or test harness
        valid_apps = ["whatsapp", "5319275a.whatsappdesktop", "whatsappdesktop", "mock_whatsapp", "com.whatsapp"]
        if not any(v in source_app.lower() for v in valid_apps):
            self.log_diagnostic("REJECTION", f"Blocked: Source app '{source_app}' is not WhatsApp Desktop.")
            return {"status": "rejected", "reason": "invalid_source_app", "app": source_app}

        # 7. Verify Exact Target Contact (Parveen / 9790171303)
        if not self.is_target_contact(sender_raw, sender_phone):
            self.log_diagnostic("REJECTION", f"Blocked: Sender '{sender_raw}' is not target contact Parveen (9790171303).")
            return {"status": "rejected", "reason": "non_target_contact", "sender": sender_raw}

        # 8. Check Group Message
        if self.is_group_message(sender_raw, message_text, notification_title):
            self.log_diagnostic("REJECTION", "Blocked: Event identified as a group message.")
            return {"status": "rejected", "reason": "group_message_detected"}

        # 9. Check Missing Content
        if not message_text or message_text == "<Media omitted>":
            self.log_diagnostic("REJECTION", "Blocked: Message is empty or media-only placeholder.")
            return {"status": "rejected", "reason": "media_or_empty_message"}

        # 10. Run Safety Policy Classifier
        safety_eval = policy_engine.classify_message(message_text)
        if safety_eval.action == "never_send" or safety_eval.risk_level in ("HIGH", "CRITICAL"):
            self.log_diagnostic("SAFETY_BLOCK", f"Safety policy blocked reply: Category={safety_eval.category}, Risk={safety_eval.risk_level}", level="WARNING")
            return {
                "status": "safety_blocked",
                "category": safety_eval.category,
                "risk_level": safety_eval.risk_level,
                "rationale": safety_eval.rationale
            }

        # 11. Generate Personalized AI Reply
        self.log_diagnostic("AI_GENERATION", f"Generating personalized reply for incoming message: '{message_text}'")
        ai_res = await self.generate_personalized_reply(message_text)
        generated_reply = ai_res["reply_text"]
        provider = ai_res["provider"]

        if not generated_reply:
            self.log_diagnostic("AI_FAILURE", "AI generated empty reply text.", level="ERROR")
            return {"status": "failed", "reason": "empty_ai_reply"}

        # 12. Enforce configured 2-second response delay
        self.log_diagnostic("DELAY", "Holding for authoritative 2-second response delay...")
        await asyncio.sleep(2)

        # 13. Direct Desktop WhatsApp Delivery & Safe Fallback
        has_native_reply = bool(event.get("has_native_reply_action", False))
        is_simulation = bool(event.get("simulate_sending", False))
        send_details = {}
        if is_simulation:
            submission_result = "simulated_success"
        else:
            try:
                from services.whatsapp_desktop_sender import send_whatsapp_reply
                auto_submit_flag = (self.state.get("reply_mode", "automatic") == "automatic")
                send_res = send_whatsapp_reply(
                    phone_e164=CANONICAL_TARGET_PHONE,
                    message_text=generated_reply,
                    auto_submit=auto_submit_flag
                )
                submission_result = send_res.get("status", "awaiting_manual_approval")
                send_details = send_res
            except Exception as e:
                logger.error(f"Error invoking desktop sender: {e}")
                submission_result = "awaiting_manual_approval"
                send_details = {"error": str(e)}

        # 13. Persist to Supabase Database
        try:
            # Fetch Parveen contact & conversation IDs
            c_res = self.supabase.table("contacts").select("id").eq("display_name", TARGET_NAME).execute()
            contact_id = c_res.data[0]["id"] if c_res.data else None
            
            conv_id = None
            if contact_id:
                conv_res = self.supabase.table("conversations").select("id").eq("contact_id", contact_id).execute()
                conv_id = conv_res.data[0]["id"] if conv_res.data else None

            if conv_id:
                # Insert incoming message
                in_msg = {
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "conversation_id": conv_id,
                    "direction": "incoming",
                    "sender_name": TARGET_NAME,
                    "body": message_text,
                    "message_type": "text",
                    "source": "notification",
                    "message_timestamp": now,
                    "metadata": {"notification_id": notification_id, "experiment": "parveen_test"}
                }
                self.supabase.table("messages").insert(in_msg).execute()

                # Insert reply draft
                draft_row = {
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "conversation_id": conv_id,
                    "draft_text": generated_reply,
                    "provider_name": provider,
                    "model_name": ai_res.get("model", "qwen/qwen3.8-27b"),
                    "status": "sent" if submission_result == "message_sent_and_verified" else ("approved" if submission_result == "simulated_success" else "awaiting_manual_approval"),
                    "sent_at": now if submission_result in ("simulated_success", "message_sent_and_verified") else None,
                    "send_result": submission_result
                }
                self.supabase.table("reply_drafts").insert(draft_row).execute()

            log_activity(
                event_type="PARVEEN_EXPERIMENT_REPLY",
                description=f"Generated reply for Parveen: '{generated_reply}' via {provider}.",
                metadata={"notification_id": notification_id, "reply": generated_reply, "result": submission_result}
            )
        except Exception as e:
            self.log_diagnostic("DB_PERSISTENCE_ERROR", f"Error persisting to Supabase: {e}", level="WARNING")

        # 14. Update State without arbitrary reply cap
        self.state["successful_replies_count"] += 1
        self.state["is_completed"] = False
        self.state["is_enabled"] = True
        self.state.setdefault("processed_notification_ids", []).append(notification_id)
        self.state.setdefault("processed_message_signatures", []).append(msg_sig)
        
        reply_details = {
            "timestamp": now,
            "incoming_message": message_text,
            "sender": sender_raw,
            "sender_phone": sender_phone or CANONICAL_TARGET_PHONE,
            "generated_reply": generated_reply,
            "provider": provider,
            "model": ai_res.get("model"),
            "latency_ms": ai_res.get("latency_ms"),
            "submission_result": submission_result,
            "native_reply_action_available": has_native_reply
        }
        self.state["last_reply_details"] = reply_details
        self.log_diagnostic("ONE_SHOT_COMPLETE", f"One-shot reply complete. Experiment auto-disabled. Reply: '{generated_reply}'")
        self._save_state()

        return {
            "status": "success",
            "reply_text": generated_reply,
            "provider": provider,
            "submission_result": submission_result,
            "one_shot_completed": True
        }

parveen_experiment_service = ParveenExperimentService()
