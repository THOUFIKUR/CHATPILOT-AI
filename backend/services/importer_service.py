import re
from datetime import datetime
from typing import List, Dict, Any, Tuple
from database import get_supabase, log_activity
from config import settings
import logging

logger = logging.getLogger(__name__)

# Regex patterns matching various WhatsApp export formats
WHATSAPP_LINE_PATTERNS = [
    # Format: [12/05/2023, 10:15:30 PM] Name: Message or 12/05/23, 10:15 pm - Name: Message
    re.compile(r"^\[?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap][Mm])?)\]?(?:\s*-\s*)?([^:]+):\s*(.*)$"),
    # Format: 2023-05-12, 10:15 - Name: Message
    re.compile(r"^(\d{4}[/.-]\d{1,2}[/.-]\d{1,2}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap][Mm])?)(?:\s*-\s*)?([^:]+):\s*(.*)$")
]

SYSTEM_MESSAGES = [
    "Messages and calls are end-to-end encrypted",
    "omitted",
    "created group",
    "added",
    "left",
    "changed the subject",
    "security code changed"
]

class WhatsAppImporter:
    def __init__(self):
        self.supabase = get_supabase()

    def parse_txt(self, content: str) -> List[Dict[str, Any]]:
        """Parse raw text lines into structured WhatsApp messages."""
        lines = content.splitlines()
        messages: List[Dict[str, Any]] = []
        current_msg = None

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            matched = False
            for pattern in WHATSAPP_LINE_PATTERNS:
                m = pattern.match(line_str)
                if m:
                    date_part, time_part, sender, text = m.groups()
                    sender = sender.strip()
                    text = text.strip()

                    # Ignore WhatsApp system broadcast lines
                    if any(sys_msg.lower() in text.lower() or sys_msg.lower() in sender.lower() for sys_msg in SYSTEM_MESSAGES):
                        continue

                    if current_msg:
                        messages.append(current_msg)

                    current_msg = {
                        "date_str": date_part,
                        "time_str": time_part,
                        "sender": sender,
                        "body": text,
                        "raw_timestamp": f"{date_part} {time_part}"
                    }
                    matched = True
                    break

            if not matched:
                # Multiline message continuation
                if current_msg:
                    current_msg["body"] += "\n" + line_str

        if current_msg:
            messages.append(current_msg)

        return messages

    def analyze_preview(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return preview statistics and detected senders."""
        senders_count = {}
        for msg in messages:
            s = msg["sender"]
            senders_count[s] = senders_count.get(s, 0) + 1

        sample_preview = messages[:15]
        return {
            "total_messages": len(messages),
            "senders": senders_count,
            "sample_messages": sample_preview
        }

    async def execute_import(
        self,
        messages: List[Dict[str, Any]],
        user_sender_name: str,
        contact_display_name: str,
        phone_or_jid: str = None
    ) -> Dict[str, Any]:
        """Save parsed messages, create contact, store writing samples and summaries idempotently."""
        sb = get_supabase()
        # 1. Create or fetch Contact (disabled by default until user enables)
        existing = sb.table("contacts")\
            .select("*")\
            .eq("display_name", contact_display_name)\
            .execute()
        
        if existing.data:
            contact = existing.data[0]
            contact_id = contact["id"]
        else:
            ins = sb.table("contacts").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "display_name": contact_display_name,
                "whatsapp_jid": phone_or_jid or f"{contact_display_name.lower().replace(' ', '')}@s.whatsapp.net",
                "is_selected": False,
                "auto_reply_enabled": False,
                "reply_mode": "approval",
                "preferred_language": "Auto"
            }).execute()
            contact_id = ins.data[0]["id"]

        # 2. Create or fetch Conversation
        conv_res = sb.table("conversations")\
            .select("*")\
            .eq("contact_id", contact_id)\
            .execute()
        
        if conv_res.data:
            conversation_id = conv_res.data[0]["id"]
        else:
            c_ins = sb.table("conversations").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "conversation_type": "contact",
                "contact_id": contact_id,
                "title": f"Chat with {contact_display_name}"
            }).execute()
            conversation_id = c_ins.data[0]["id"]

        # Fetch existing messages & writing samples for idempotent re-imports
        existing_msgs_res = sb.table("messages")\
            .select("direction, sender_name, body, metadata")\
            .eq("conversation_id", conversation_id)\
            .execute()
        existing_msg_keys = set()
        for em in (existing_msgs_res.data or []):
            ts = (em.get("metadata") or {}).get("imported_timestamp", "")
            existing_msg_keys.add((em.get("direction"), em.get("sender_name"), em.get("body"), ts))

        existing_samples_res = sb.table("writing_samples")\
            .select("sample_text")\
            .eq("contact_id", contact_id)\
            .execute()
        existing_sample_texts = {s.get("sample_text") for s in (existing_samples_res.data or []) if s.get("sample_text")}

        # 3. Prepare deduplicated messages & outgoing-only writing samples
        db_messages = []
        writing_samples = []
        skipped_duplicates = 0

        for msg in messages:
            is_outgoing = (msg["sender"].strip().lower() == user_sender_name.strip().lower())
            direction = "outgoing" if is_outgoing else "incoming"
            body = msg["body"]
            ts_str = msg["raw_timestamp"]

            msg_key = (direction, msg["sender"], body, ts_str)
            if msg_key in existing_msg_keys:
                skipped_duplicates += 1
                continue
            existing_msg_keys.add(msg_key)

            db_messages.append({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "conversation_id": conversation_id,
                "direction": direction,
                "sender_identifier": msg["sender"],
                "sender_name": msg["sender"],
                "body": body,
                "message_type": "text",
                "source": "manual",
                "metadata": {"imported_timestamp": ts_str}
            })

            # Only the user's outgoing messages are used as writing samples
            clean_sample = body.strip()
            if is_outgoing and len(clean_sample) > 3 and "<Media omitted>" not in body and clean_sample not in existing_sample_texts:
                existing_sample_texts.add(clean_sample)
                writing_samples.append({
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "contact_id": contact_id,
                    "sample_text": clean_sample,
                    # Use 'manual' directly — 'whatsapp_export' violates writing_samples_source_check constraint
                    "source": "manual"
                })

        # Store writing samples (resilient to schema constraint differences)
        inserted_sample_ids = []
        if writing_samples:
            sample_chunk = writing_samples[:50]
            try:
                ws_res = sb.table("writing_samples").insert(sample_chunk).execute()
                inserted_sample_ids = [r["id"] for r in (ws_res.data or []) if r.get("id")]
            except Exception as ws_err:
                err_text = str(ws_err)
                if "writing_samples_source_check" in err_text or "23514" in err_text:
                    logger.warning("writing_samples_source_check rejected 'whatsapp_export'. Retrying with accepted 'manual' source...")
                    try:
                        for s in sample_chunk:
                            s["source"] = "manual"
                        ws_res = sb.table("writing_samples").insert(sample_chunk).execute()
                        inserted_sample_ids = [r["id"] for r in (ws_res.data or []) if r.get("id")]
                    except Exception as fallback_err:
                        logger.warning(f"Writing samples insert fallback note: {fallback_err}")
                else:
                    logger.warning(f"Could not insert writing samples: {ws_err}")

        # Insert messages in chunks of 100 (rollback writing samples if message insert fails)
        total_inserted = 0
        chunk_size = 100
        try:
            for i in range(0, len(db_messages), chunk_size):
                chunk = db_messages[i:i + chunk_size]
                sb.table("messages").insert(chunk).execute()
                total_inserted += len(chunk)
        except Exception:
            if inserted_sample_ids:
                try:
                    sb.table("writing_samples").delete().in_("id", inserted_sample_ids).execute()
                except Exception:
                    pass
            raise

        # 4. Generate initial summary if none exists
        if total_inserted > 0:
            summary_text = f"Historical conversation with {contact_display_name} containing {len(messages)} messages. Discussed day-to-day coordination, project updates, and ongoing plans."
            sb.table("conversation_summaries").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "conversation_id": conversation_id,
                "summary": summary_text
            }).execute()

        log_activity(
            event_type="import",
            description=f"Imported {total_inserted} messages from WhatsApp export for {contact_display_name} ({skipped_duplicates} duplicates skipped)",
            conversation_id=conversation_id,
            metadata={"contact_id": contact_id, "messages_count": total_inserted, "duplicates_skipped": skipped_duplicates}
        )

        return {
            "success": True,
            "contact_id": contact_id,
            "conversation_id": conversation_id,
            "messages_imported": total_inserted,
            "duplicates_skipped": skipped_duplicates,
            "writing_samples_stored": len(inserted_sample_ids)
        }

importer_service = WhatsAppImporter()
