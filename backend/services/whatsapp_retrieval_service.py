import re
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from database import get_supabase
from config import settings

logger = logging.getLogger(__name__)

# Known aliases for high-priority contacts
KNOWN_ALIASES = {
    "parveen": ["parveen", "mom", "ammi", "ammu", "مومياء", "9790171303", "+919790171303"],
}

def format_clean_timestamp(iso_str: Optional[str]) -> str:
    """Formats an ISO timestamp into a readable human format like '24 Nov 2026, 01:32 PM'."""
    if not iso_str:
        return "Unknown Date"
    try:
        # Clean fractional seconds if any
        clean_str = iso_str.split('+')[0].replace('Z', '')
        if '.' in clean_str:
            dt = datetime.fromisoformat(clean_str)
        else:
            dt = datetime.strptime(clean_str, "%Y-%m-%dT%H:%M:%S")
        return dt.strftime("%d %b %Y, %I:%M %p")
    except Exception:
        return str(iso_str)[:19].replace('T', ' ')

class WhatsAppRetrievalService:
    def __init__(self):
        self.supabase = get_supabase()

    def resolve_contact(self, identifier: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> Optional[Dict[str, Any]]:
        """Resolves a contact by UUID, display_name, phone number, or known alias."""
        clean_id = (identifier or "").strip().lower()
        if not clean_id:
            return None

        # 1. Check if identifier matches UUID format
        if len(clean_id) == 36 and '-' in clean_id:
            try:
                res = self.supabase.table("contacts").select("*").eq("id", clean_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.debug(f"UUID lookup error: {e}")

        # 2. Check known aliases (e.g. Parveen)
        canonical_name = None
        for name, aliases in KNOWN_ALIASES.items():
            if clean_id in aliases or any(a in clean_id for a in aliases):
                canonical_name = name
                break

        query_name = canonical_name if canonical_name else clean_id

        # 3. Search in contacts table by display_name or phone
        try:
            res = self.supabase.table("contacts").select("*").ilike("display_name", f"%{query_name}%").execute()
            if res.data:
                # Prioritize exact display_name match
                for c in res.data:
                    if c.get("display_name", "").lower() == query_name.lower():
                        return c
                return res.data[0]
        except Exception as e:
            logger.debug(f"Contact name search error: {e}")

        # 4. Search by phone number
        digits = re.sub(r'\D', '', clean_id)
        if len(digits) >= 10:
            try:
                res = self.supabase.table("contacts").select("*").ilike("phone_e164", f"%{digits[-10:]}%").execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.debug(f"Contact phone search error: {e}")

        return None

    def get_conversation_for_contact(self, contact_id: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> Optional[Dict[str, Any]]:
        """Retrieves the conversation record associated with a contact."""
        try:
            res = self.supabase.table("conversations").select("*").eq("contact_id", contact_id).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.error(f"Error fetching conversation for contact {contact_id}: {e}")
        return None

    def get_latest_outgoing_reply(self, contact_id: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> Optional[Dict[str, Any]]:
        """
        Retrieves the exact last message sent by Thoufikur (direction == 'outgoing')
        to this specific contact. Filters out empty or omitted media if text is available.
        """
        conv = self.get_conversation_for_contact(contact_id, owner_id)
        if not conv:
            return None

        conv_id = conv["id"]
        try:
            # Query outgoing messages ordered by message_timestamp desc (with created_at fallback)
            res = self.supabase.table("messages")\
                .select("id, conversation_id, direction, sender_name, body, message_type, message_timestamp, created_at")\
                .eq("conversation_id", conv_id)\
                .eq("direction", "outgoing")\
                .order("message_timestamp", desc=True)\
                .limit(5)\
                .execute()

            if res.data:
                for msg in res.data:
                    body = (msg.get("body") or "").strip()
                    if body:
                        ts = msg.get("message_timestamp") or msg.get("created_at")
                        return {
                            "id": msg["id"],
                            "conversation_id": conv_id,
                            "direction": "outgoing",
                            "sender_name": "Thoufikur (You)",
                            "body": body,
                            "is_media": body == "<Media omitted>" or msg.get("message_type") == "media_placeholder",
                            "timestamp": ts,
                            "formatted_time": format_clean_timestamp(ts)
                        }
        except Exception as e:
            logger.error(f"Error retrieving latest outgoing reply for {contact_id}: {e}")
        return None

    def get_latest_incoming_message(self, contact_id: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> Optional[Dict[str, Any]]:
        """
        Retrieves the exact last incoming message received from this contact.
        """
        conv = self.get_conversation_for_contact(contact_id, owner_id)
        if not conv:
            return None

        conv_id = conv["id"]
        try:
            res = self.supabase.table("messages")\
                .select("id, conversation_id, direction, sender_name, body, message_type, message_timestamp, created_at")\
                .eq("conversation_id", conv_id)\
                .eq("direction", "incoming")\
                .order("message_timestamp", desc=True)\
                .limit(5)\
                .execute()

            if res.data:
                for msg in res.data:
                    body = (msg.get("body") or "").strip()
                    if body:
                        ts = msg.get("message_timestamp") or msg.get("created_at")
                        return {
                            "id": msg["id"],
                            "conversation_id": conv_id,
                            "direction": "incoming",
                            "sender_name": msg.get("sender_name") or "Contact",
                            "body": body,
                            "is_media": body == "<Media omitted>" or msg.get("message_type") == "media_placeholder",
                            "timestamp": ts,
                            "formatted_time": format_clean_timestamp(ts)
                        }
        except Exception as e:
            logger.error(f"Error retrieving latest incoming message for {contact_id}: {e}")
        return None

    def get_recent_conversation_history(
        self, 
        contact_id: str, 
        limit: int = 10, 
        owner_id: str = settings.DEFAULT_OWNER_ID
    ) -> List[Dict[str, Any]]:
        """
        Retrieves recent chronological conversation messages (both incoming & outgoing)
        with timestamps, sender attribution, and media labels.
        """
        conv = self.get_conversation_for_contact(contact_id, owner_id)
        if not conv:
            return []

        conv_id = conv["id"]
        try:
            # Query recent messages
            res = self.supabase.table("messages")\
                .select("id, conversation_id, direction, sender_name, body, message_type, message_timestamp, created_at")\
                .eq("conversation_id", conv_id)\
                .order("message_timestamp", desc=True)\
                .limit(limit)\
                .execute()

            msgs = res.data or []
            # Reverse to chronological order (oldest to newest)
            chronological = list(reversed(msgs))

            formatted = []
            for m in chronological:
                body = (m.get("body") or "").strip()
                if not body:
                    continue

                direction = m.get("direction", "incoming")
                sender = "Thoufikur (You)" if direction == "outgoing" else (m.get("sender_name") or conv.get("title") or "Contact")
                ts = m.get("message_timestamp") or m.get("created_at")
                is_media = body == "<Media omitted>" or m.get("message_type") == "media_placeholder"

                display_body = "[Media Attachment: Photo / Voice Note]" if is_media else body

                formatted.append({
                    "id": m["id"],
                    "conversation_id": conv_id,
                    "direction": direction,
                    "sender_name": sender,
                    "body": display_body,
                    "raw_body": body,
                    "is_media": is_media,
                    "timestamp": ts,
                    "formatted_time": format_clean_timestamp(ts)
                })

            return formatted
        except Exception as e:
            logger.error(f"Error retrieving recent history for {contact_id}: {e}")
            return []

    def detect_intent_and_retrieve(
        self, 
        prompt: str, 
        context_refs: List[Dict[str, Any]] = None,
        owner_id: str = settings.DEFAULT_OWNER_ID
    ) -> Dict[str, Any]:
        """
        Analyzes the user's prompt and attached context chips.
        If a question about a specific contact or WhatsApp history is detected,
        retrieves verified records and constructs a dedicated evidence payload.
        """
        context_refs = context_refs or []
        lower_prompt = (prompt or "").lower()

        # 1. Identify target contact from context_refs or prompt text
        contact = None
        for ref in context_refs:
            if ref.get("ref_type") == "contact" and ref.get("ref_id"):
                contact = self.resolve_contact(ref.get("ref_id"), owner_id)
                if contact:
                    break

        if not contact:
            # Check prompt for known names/aliases
            for name, aliases in KNOWN_ALIASES.items():
                if any(re.search(rf"\b{re.escape(a)}\b", lower_prompt) for a in aliases):
                    contact = self.resolve_contact(name, owner_id)
                    if contact:
                        break

        # Check all contacts in database if still not resolved
        if not contact:
            try:
                c_list = self.supabase.table("contacts").select("id, display_name").eq("owner_id", owner_id).execute()
                for c in (c_list.data or []):
                    cname = c.get("display_name", "").lower()
                    if cname and re.search(rf"\b{re.escape(cname)}\b", lower_prompt):
                        contact = self.resolve_contact(c["id"], owner_id)
                        break
            except Exception as e:
                logger.debug(f"Contacts scan error: {e}")

        # If no specific contact identified, return empty retrieval
        if not contact:
            return {
                "has_whatsapp_context": False,
                "contact": None,
                "intent": "general",
                "evidence_text": "",
                "messages": [],
                "latest_outgoing": None,
                "latest_incoming": None
            }

        contact_id = contact["id"]
        contact_name = contact.get("display_name", "Contact")

        # 2. Determine intent
        intent = "general_history"
        if any(k in lower_prompt for k in ["last reply", "last message to", "what was my reply", "did i reply", "when did i message", "what did i say", "my last response"]):
            intent = "latest_outgoing"
        elif any(k in lower_prompt for k in ["what did she message", "what did he message", "what did she ask", "what did they message", "incoming", "received"]):
            intent = "latest_incoming"
        elif any(k in lower_prompt for k in ["summarize", "summary", "conversation with", "show latest", "recent chat", "history"]):
            intent = "conversation_summary"

        # 3. Retrieve relevant records
        latest_outgoing = self.get_latest_outgoing_reply(contact_id, owner_id)
        latest_incoming = self.get_latest_incoming_message(contact_id, owner_id)
        recent_history = self.get_recent_conversation_history(contact_id, limit=8, owner_id=owner_id)

        # 4. Construct high-confidence evidence text for AI prompt
        evidence_lines = [
            f"=== VERIFIED WHATSAPP HISTORICAL DATABASE RECORDS FOR: {contact_name} ===",
            f"Contact ID: {contact_id} | Phone: {contact.get('phone_e164', 'N/A')}",
        ]

        if latest_outgoing:
            evidence_lines.append(f"LATEST OUTGOING MESSAGE (SENT BY THOUFIKUR):\n- Text: \"{latest_outgoing['body']}\"\n- Timestamp: {latest_outgoing['formatted_time']}")
        else:
            evidence_lines.append("LATEST OUTGOING MESSAGE: [No verified outgoing message recorded in database]")

        if latest_incoming:
            evidence_lines.append(f"LATEST INCOMING MESSAGE (RECEIVED FROM {contact_name}):\n- Text: \"{latest_incoming['body']}\"\n- Timestamp: {latest_incoming['formatted_time']}")

        if recent_history:
            evidence_lines.append("\nRECENT CHRONOLOGICAL CONVERSATION LOG:")
            for m in recent_history:
                evidence_lines.append(f"[{m['direction'].upper()}] {m['sender_name']} ({m['formatted_time']}): \"{m['body']}\"")
        else:
            evidence_lines.append("\nRECENT CONVERSATION LOG: [No message history found]")

        evidence_lines.append("=====================================================================")

        evidence_text = "\n".join(evidence_lines)

        return {
            "has_whatsapp_context": True,
            "contact": {
                "id": contact_id,
                "display_name": contact_name,
                "phone_e164": contact.get("phone_e164", "")
            },
            "intent": intent,
            "evidence_text": evidence_text,
            "messages": recent_history,
            "latest_outgoing": latest_outgoing,
            "latest_incoming": latest_incoming
        }

whatsapp_retrieval_service = WhatsAppRetrievalService()
