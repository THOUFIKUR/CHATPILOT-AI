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

class ReplyEngine:
    def __init__(self):
        self.supabase = get_supabase()

    def is_high_risk(self, message_text: str) -> bool:
        lower = message_text.lower()
        return any(k in lower for k in HIGH_RISK_KEYWORDS)

    async def process_incoming_message(
        self,
        sender_name: str,
        message_body: str,
        contact_id: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Core AI Reply flow."""
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

        # 5. Load style profile
        style_info = style_service.get_contact_style(contact_id)

        # 6. Load recent conversation history (last 6 messages)
        history_res = self.supabase.table("messages")\
            .select("direction, sender_name, body")\
            .eq("conversation_id", conversation_id)\
            .order("created_at", desc=True)\
            .limit(6)\
            .execute()
        history_msgs = list(reversed(history_res.data or []))

        # Assemble prompt
        system_instructions = f"""You are ChatPilot AI, acting as Thoufikur Rahman in a personal WhatsApp conversation.
Reply to {sender_name} naturally, accurately, and concisely.

USER WRITING STYLE FOR THIS CONTACT:
- Language: {style_info.get('detected_languages', ['English'])[0]}
- Tone: {style_info.get('tone', 'Casual & friendly')}
- Sentence length: {style_info.get('sentence_length', 'Short')}
- Slang / habits: {", ".join(style_info.get('slang_tags', []))}

CONTACT MEMORY:
{memory_context}

{f"CUSTOM INSTRUCTION FOR THIS CONTACT: {custom_prompt}" if custom_prompt else ""}

STRICT RULES:
1. Speak as Thoufikur Rahman in first-person ("I", "me", "my").
2. Match the exact tone and language preference (Tamil / Tanglish / English).
3. Be brief and natural, exactly like a WhatsApp text message. Do not write emails.
4. Never invent personal commitments, meetings or promises you do not know about.
5. If unsure, give a friendly natural response acknowledging the message.
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
            max_tokens=150
        )

        draft_text = (ai_res.get("content") or "").strip()
        provider_used = ai_res.get("provider", "groq")
        model_used = ai_res.get("model", "qwen/qwen3.8-27b")

        # Guard against saving empty drafts
        if not draft_text:
            log_activity(
                event_type="reply_failed",
                description=f"AI model produced empty response for {sender_name}",
                conversation_id=conversation_id,
                metadata={"provider": provider_used, "model": model_used, "incoming_message": message_body}
            )
            return {
                "success": False,
                "error": "empty_draft_generated",
                "conversation_id": conversation_id,
                "contact_name": sender_name
            }

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
            "latency_ms": ai_res.get("latency_ms")
        }

reply_engine = ReplyEngine()
