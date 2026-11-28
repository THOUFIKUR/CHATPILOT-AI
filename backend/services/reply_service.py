import re
from typing import Dict, Any, Optional
from database import get_supabase, log_activity
from config import settings
from services.ai_manager import ai_manager
from services.style_service import style_service
import logging

logger = logging.getLogger(__name__)

# Security trigger keywords that must never be answered automatically
HIGH_RISK_KEYWORDS = [
    "otp", "one time password", "verification code", "cvv", "atm pin",
    "bank account", "transfer money", "credit card", "password", "netbanking",
    "gpay pin", "upi pin"
]

# Patterns for important decisions requiring human approval (dates, travel, bookings, money, commitments)
IMPORTANT_DECISION_PATTERNS = [
    r"\b(trip|tour|goa|bangalore|chennai|delhi|mumbai|kodaikanal|ooty)\b",
    r"\b(flight|train|bus|ticket|tickets|hotel|resort|room|stay|booking|book)\b",
    r"\b(choose|pick|preferred|prefer)\b.*\b(date|day|time|month|weekend|slot)\b",
    r"\b(date|day|time)\b.*\b(preferred|prefer|free|available|confirm)\b",
    r"\b(send|transfer|pay|paid|payment|gpay|phonepe|upi|rupees|rs\.?|cash|borrow|lend|amount)\b",
    r"\b(promise|deal|contract|commit)\b"
]

class ReplyEngine:
    def __init__(self):
        self.supabase = get_supabase()

    def is_high_risk(self, message_text: str) -> bool:
        lower = message_text.lower()
        return any(k in lower for k in HIGH_RISK_KEYWORDS)

    def is_important_decision(self, message_text: str) -> bool:
        lower = message_text.lower()
        for pat in IMPORTANT_DECISION_PATTERNS:
            if re.search(pat, lower):
                return True
        return False

    async def process_incoming_message(
        self,
        sender_name: str,
        message_body: str,
        contact_id: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Core AI Reply flow."""
        # Guard: Never process or auto-reply to messages from self ("You", "Me")
        # Covers ASCII and Unicode small-caps variants of the operator's name
        import unicodedata
        def _ascii_fold(s: str) -> str:
            try:
                return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").strip().lower()
            except Exception:
                return s.strip().lower()

        clean_name = (sender_name or "").strip().lower()
        folded_name = _ascii_fold(sender_name or "")
        SELF_LABELS = {"you", "me", "self"}
        OWNER_NAMES = {"thoufikur", "thoufikur rahman", "thoufikur rahaman", "thoufikur rahaman y"}
        if (clean_name in SELF_LABELS or folded_name in OWNER_NAMES
                or any(n in folded_name for n in ("thoufikur",))):
            logger.info(f"Refusing to process incoming message from self ({sender_name})")
            logger.info(f"Refusing to process incoming message from self ({sender_name})")
            return {
                "blocked": True,
                "reason": "outgoing_message_from_self",
                "sender_name": sender_name
            }

        # 1. Identify contact
        contact = None
        if contact_id:
            c_res = self.supabase.table("contacts").select("*").eq("id", contact_id).execute()
            if c_res.data:
                contact = c_res.data[0]
        elif sender_name:
            import re
            c_res = self.supabase.table("contacts").select("*").ilike("display_name", f"%{sender_name}%").execute()
            if c_res.data:
                contact = c_res.data[0]
                contact_id = contact["id"]
            else:
                s_clean = re.sub(r'[^\w\s]', '', sender_name).strip()
                if s_clean and len(s_clean) >= 3:
                    c_clean = self.supabase.table("contacts").select("*").ilike("display_name", f"%{s_clean}%").execute()
                    if c_clean.data:
                        contact = c_clean.data[0]
                        contact_id = contact["id"]

        # If contact not found, create a lightweight contact (disabled by default)
        if not contact:
            new_c = self.supabase.table("contacts").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "display_name": sender_name,
                "whatsapp_jid": f"{sender_name.lower().replace(' ', '')}@s.whatsapp.net",
                "is_selected": False,
                "auto_reply_enabled": False,
                "reply_mode": "approval",
                "preferred_language": "Auto"
            }).execute()
            contact = new_c.data[0]
            contact_id = contact["id"]

        # 2. Identify or create conversation
        if not conversation_id:
            conv_res = self.supabase.table("conversations").select("*").eq("contact_id", contact_id).execute()
            if conv_res.data:
                conversation_id = conv_res.data[0]["id"]
            else:
                c_ins = self.supabase.table("conversations").insert({
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "conversation_type": "contact",
                    "contact_id": contact_id,
                    "title": f"Chat with {contact['display_name']}"
                }).execute()
                conversation_id = c_ins.data[0]["id"]

        # Save incoming message
        msg_ins = self.supabase.table("messages").insert({
            "owner_id": settings.DEFAULT_OWNER_ID,
            "conversation_id": conversation_id,
            "direction": "incoming",
            "sender_name": sender_name,
            "body": message_body,
            "source": "notification"
        }).execute()
        source_message_id = msg_ins.data[0]["id"]

        # Check 2b: Explicit confirmation of a staged pending action (e.g. "Yeah, okay")
        from services.action_approval_service import action_approval_service
        if action_approval_service.is_confirmation(message_body):
            pending = action_approval_service.get_pending_action_for_contact(sender_name)
            if pending:
                exec_res = action_approval_service.execute_action(pending["id"])
                reply_text = f"Attached and sent {pending.get('filename')} on WhatsApp."
                # Persist outgoing message
                try:
                    self.supabase.table("messages").insert({
                        "owner_id": settings.DEFAULT_OWNER_ID,
                        "conversation_id": conversation_id,
                        "direction": "outgoing",
                        "sender_name": "Thoufikur Rahman",
                        "body": reply_text,
                        "source": "auto_reply"
                    }).execute()
                except Exception:
                    pass

                return {
                    "success": True,
                    "action_executed": True,
                    "action_id": pending["id"],
                    "conversation_id": conversation_id,
                    "contact_name": sender_name,
                    "incoming_message": message_body,
                    "draft_text": reply_text,
                    "provider": "action_execution_engine",
                    "model": "action_executor",
                    "requires_approval": False
                }

        # Check 2c: Context-aware study file request (e.g. "Dai, send me the PE notes")
        from services.file_indexer import file_indexer
        file_req = file_indexer.extract_file_request(message_body)
        if file_req:
            matched_files = file_indexer.search_files(message_body)
            if matched_files:
                top_file = matched_files[0]
                pending = action_approval_service.create_pending_action(
                    action_type="send_whatsapp_attachment",
                    recipient_name=sender_name,
                    recipient_jid=contact.get("whatsapp_jid"),
                    file_path=top_file["file_path"],
                    filename=top_file["filename"],
                    conversation_id=conversation_id,
                    summary=f"Send {top_file['filename']} to {sender_name}"
                )
                draft_text = f"Found '{top_file['filename']}'. Should I send it to {sender_name}?"
                
                # Save draft for operator ratification
                draft_ins = self.supabase.table("reply_drafts").insert({
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "conversation_id": conversation_id,
                    "source_message_id": source_message_id,
                    "draft_text": draft_text,
                    "provider_name": "file_indexer",
                    "model_name": "context_file_search",
                    "status": "pending"
                }).execute()
                draft_id = draft_ins.data[0]["id"]
                
                log_activity(
                    event_type="awaiting_approval",
                    description=f"Staged file attachment '{top_file['filename']}' for {sender_name} — awaiting approval",
                    conversation_id=conversation_id,
                    metadata={"action_id": pending["id"], "file": top_file["filename"], "recipient": sender_name}
                )

                return {
                    "success": True,
                    "draft_id": draft_id,
                    "action_id": pending["id"],
                    "conversation_id": conversation_id,
                    "contact_name": sender_name,
                    "incoming_message": message_body,
                    "draft_text": draft_text,
                    "provider": "file_indexer",
                    "model": "context_file_search",
                    "requires_approval": True,
                    "staged_file": top_file
                }

        # 3. Check automation and high risk
        if self.is_high_risk(message_body):
            log_activity(
                event_type="security_block",
                description=f"Blocked auto-generation for high-risk/sensitive message from {sender_name}",
                conversation_id=conversation_id
            )
            return {
                "blocked": True,
                "reason": "High risk content (OTP/financial/password)",
                "source_message_id": source_message_id
            }

        # 4. Check contact prompt & memory
        prompt_res = self.supabase.table("contact_prompts").select("*").eq("contact_id", contact_id).execute()
        custom_prompt = prompt_res.data[0]["system_prompt"] if prompt_res.data else ""

        memory_res = self.supabase.table("contact_memory").select("*").eq("contact_id", contact_id).execute()
        memories = [f"- {m['memory_key']}: {m['memory_value']}" for m in (memory_res.data or [])]
        memory_context = "\n".join(memories) if memories else "No specific facts recorded yet."

        # 5. Load style profile with authentic examples
        style_info = style_service.get_contact_style(contact_id)
        example_samples = style_info.get("example_samples", [])
        formatted_examples = "\n".join(f'  * "{s}"' for s in example_samples[:5]) if example_samples else "  * (Casual, concise, natural Tanglish)"
        top_emojis_str = " ".join(style_info.get("top_emojis", []))

        # 6. Load recent conversation history (last 20 messages for rich conversational context)
        history_res = self.supabase.table("messages")\
            .select("direction, sender_name, body")\
            .eq("conversation_id", conversation_id)\
            .order("created_at", desc=True)\
            .limit(20)\
            .execute()
        history_msgs = list(reversed(history_res.data or []))

        # Assemble prompt with strict anti-robotic rules & logical reasoning
        system_instructions = f"""You are Thoufikur Rahman replying to {sender_name} on personal WhatsApp.
Speak authentically as Thoufikur in first-person ("I", "me", "my").

THOUFIKUR'S AUTHENTIC WRITING STYLE FOR THIS CONTACT:
- Language: {style_info.get('detected_languages', ['Tanglish / English'])[0]}
- Tone: {style_info.get('tone', 'Casual & friendly')}
- Typical message length: {style_info.get('sentence_length', 'Short (1-6 words)')}
- Slang & vocabulary signals: {", ".join(style_info.get('slang_tags', []))}
{f"- Emojis Thoufikur uses with this contact: {top_emojis_str}" if top_emojis_str else ""}

REAL EXAMPLES OF HOW THOUFIKUR ACTUALLY TEXTS THIS PERSON:
{formatted_examples}

CONTACT MEMORY & FACTS:
{memory_context}

{f"CUSTOM CONTACT RULES & NEGATIVE CONSTRAINTS:\n{custom_prompt}\n" if custom_prompt else ""}
CRITICAL TEXTING RULES:
1. NEVER sound like a chatbot or assistant. NEVER say "Fair point", "Noted", "My bad!", "I'm just here to keep things simple", or "As an AI".
2. NEVER use exclamation marks "!" unless Thoufikur uses them in the examples above. Text in relaxed lowercase or normal casing with natural punctuation.
3. CONVERSATIONAL REASONING: Read the previous conversation flow carefully. If {sender_name} asks a question, presents choices (e.g. "choose one or two and tell me why"), or questions a prior message, THINK logically, choose an option, and give a clear, natural explanation. Never repeat generic phrases like "okey maa" or "seri" when a real answer is asked.
4. STRICT COMPLIANCE: Obey all custom rules above (e.g., if told never to say "bro", NEVER say "bro").
5. SHORTHAND & TYPOS:
   - Understand modern mobile texting abbreviations (gn = good night, gm = good morning, btw = by the way, u = you, r = are, y = why, whr = where, pls/plz = please, tq/ty = thank you, idk = I don't know, tbh = to be honest, hru = how are you, wbu = what about you, k/kk = okay, tc = take care, brb = be right back).
   - Autocorrect incoming typos seamlessly (e.g. "coorect" -> "correct", "repky" -> "reply", "vam" -> "coming/varren", "tomorow" -> "tomorrow"). Do not mention typos; reply naturally to the intended meaning.
6. PRESENCE & CLARITY:
   - For simple greetings or presence checks like "hello are u there?" or "heyyy reply to this", give a natural, responsive reply (e.g. "Yeah, I'm here. What's up?" or "Haha yeah, tell me").
   - If a message is unclear or ambiguous, do NOT fabricate facts. Think twice and respond casually or ask a quick, natural clarification question.
7. Output ONLY the raw WhatsApp reply text. No quotes, no intro, no emojis unless natural.
"""

        chat_messages = []
        for h in history_msgs[:-1]: # exclude the latest message because we pass it as current user message
            role = "assistant" if h["direction"] == "outgoing" else "user"
            chat_messages.append({"role": role, "content": h["body"]})

        chat_messages.append({"role": "user", "content": message_body})

        # 7. Generate draft with AI Manager
        ai_res = await ai_manager.generate_response(
            messages=chat_messages,
            system_prompt=system_instructions,
            temperature=0.7,
            max_tokens=250
        )

        draft_text = (ai_res.get("content") or "").strip().strip('"').strip("'").strip()
        provider_used = ai_res.get("provider", "groq")
        model_used = ai_res.get("model", "qwen/qwen3.8-27b")

        # Guard against saving empty drafts
        if not draft_text:
            log_activity(
                event_type="generation_failed",
                description=f"AI generation failed to produce non-empty reply for {sender_name}",
                conversation_id=conversation_id,
                metadata={"provider": provider_used, "model": model_used, "incoming_message": message_body}
            )
            return {
                "success": False,
                "error": "empty_draft_generated",
                "conversation_id": conversation_id,
                "contact_name": sender_name
            }

        # Check risk classification for important decisions requiring human ratification
        is_decision = self.is_important_decision(message_body)

        # 8. Idempotent draft saving: update existing pending draft or insert single new draft
        existing_draft = self.supabase.table("reply_drafts")\
            .select("id")\
            .eq("conversation_id", conversation_id)\
            .eq("source_message_id", source_message_id)\
            .eq("status", "pending")\
            .execute()

        if existing_draft.data:
            draft_id = existing_draft.data[0]["id"]
            self.supabase.table("reply_drafts").update({
                "draft_text": draft_text,
                "provider_name": provider_used,
                "model_name": model_used
            }).eq("id", draft_id).execute()
        else:
            draft_ins = self.supabase.table("reply_drafts").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "conversation_id": conversation_id,
                "source_message_id": source_message_id,
                "draft_text": draft_text,
                "provider_name": provider_used,
                "model_name": model_used,
                "status": "pending"
            }).execute()
            draft_id = draft_ins.data[0]["id"]

        if is_decision:
            log_activity(
                event_type="awaiting_approval",
                description=f"Draft generated for {sender_name} — awaiting approval for important decision (dates/plans/money)",
                conversation_id=conversation_id,
                metadata={
                    "provider": provider_used,
                    "model": model_used,
                    "incoming_message": message_body,
                    "reply_text": draft_text,
                    "draft_text": draft_text,
                    "contact": sender_name,
                    "requires_approval": True
                }
            )
        else:
            log_activity(
                event_type="reply_generated",
                description=f"Generated draft reply for {sender_name} using {provider_used} ({model_used})",
                conversation_id=conversation_id,
                metadata={
                    "provider": provider_used,
                    "model": model_used,
                    "incoming_message": message_body,
                    "reply_text": draft_text,
                    "draft_text": draft_text,
                    "contact": sender_name
                }
            )

        return {
            "success": True,
            "draft_id": draft_id,
            "conversation_id": conversation_id,
            "contact_name": sender_name,
            "incoming_message": message_body,
            "draft_text": draft_text,
            "provider": provider_used,
            "model": model_used,
            "latency_ms": ai_res.get("latency_ms"),
            "requires_approval": is_decision
        }

reply_engine = ReplyEngine()
