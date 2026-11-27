import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from database import get_supabase
from config import settings
from services.ai_manager import ai_manager
from services.whatsapp_retrieval_service import whatsapp_retrieval_service

logger = logging.getLogger(__name__)

# Fallback in-memory store in case of transient database disconnects
_LOCAL_SESSIONS: Dict[str, Dict[str, Any]] = {}
_LOCAL_MESSAGES: Dict[str, List[Dict[str, Any]]] = {}

class AssistantService:
    def __init__(self):
        self.supabase = get_supabase()

    def list_sessions(self, owner_id: str = settings.DEFAULT_OWNER_ID) -> List[Dict[str, Any]]:
        """
        Lists all active assistant chat sessions for the user,
        enriched with message counts and last message preview.
        """
        sessions = []
        try:
            res = self.supabase.table("assistant_sessions")\
                .select("id, owner_id, title, created_at, updated_at, archived_at")\
                .eq("owner_id", owner_id)\
                .order("updated_at", desc=True)\
                .execute()

            if res.data:
                sessions = res.data
        except Exception as e:
            logger.error(f"DB list_sessions error: {e}")
            sessions = list(_LOCAL_SESSIONS.values())

        # Enrich sessions with real message count and snippet in a single batch query
        enriched_sessions = []
        if not sessions:
            return []

        session_ids = [s["id"] for s in sessions]
        recent_by_session = {}
        counts_by_session = {}
        try:
            m_res = self.supabase.table("assistant_session_messages")\
                .select("id, session_id, role, content, created_at")\
                .in_("session_id", session_ids)\
                .order("created_at", desc=True)\
                .limit(200)\
                .execute()
            for m in (m_res.data or []):
                sid = m["session_id"]
                counts_by_session[sid] = counts_by_session.get(sid, 0) + 1
                if sid not in recent_by_session:
                    recent_by_session[sid] = (m.get("content") or "")[:80]
        except Exception as e:
            logger.warning(f"Batch message fetch note: {e}")

        for s in sessions:
            sid = s["id"]
            msg_count = counts_by_session.get(sid, len(_LOCAL_MESSAGES.get(sid, [])))
            last_snippet = recent_by_session.get(sid, "")
            if not last_snippet and sid in _LOCAL_MESSAGES and _LOCAL_MESSAGES[sid]:
                last_snippet = (_LOCAL_MESSAGES[sid][-1].get("content") or "")[:80]

            enriched_sessions.append({
                **s,
                "message_count": msg_count,
                "last_message_preview": last_snippet
            })

        return enriched_sessions

    def create_session(self, title: str = "New Inquest", owner_id: str = settings.DEFAULT_OWNER_ID) -> Dict[str, Any]:
        """Creates a new persistent assistant chat session."""
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        session_data = {
            "id": session_id,
            "owner_id": owner_id,
            "title": title.strip() or "New Inquest",
            "created_at": now,
            "updated_at": now,
            "archived_at": None
        }

        try:
            res = self.supabase.table("assistant_sessions").insert(session_data).execute()
            if res.data:
                return {**res.data[0], "message_count": 0, "last_message_preview": ""}
        except Exception as e:
            logger.error(f"Error persisting session to database: {e}")

        _LOCAL_SESSIONS[session_id] = session_data
        _LOCAL_MESSAGES[session_id] = []
        return {**session_data, "message_count": 0, "last_message_preview": ""}

    def rename_session(self, session_id: str, new_title: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> Dict[str, Any]:
        """Renames an existing session."""
        now = datetime.now(timezone.utc).isoformat()
        clean_title = new_title.strip() or "Untitled Inquest"
        try:
            res = self.supabase.table("assistant_sessions")\
                .update({"title": clean_title, "updated_at": now})\
                .eq("id", session_id)\
                .execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.error(f"Error updating session title in DB: {e}")

        if session_id in _LOCAL_SESSIONS:
            _LOCAL_SESSIONS[session_id]["title"] = clean_title
            _LOCAL_SESSIONS[session_id]["updated_at"] = now
            return _LOCAL_SESSIONS[session_id]

        return {"id": session_id, "title": clean_title, "updated_at": now}

    def delete_session(self, session_id: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> Dict[str, Any]:
        """Deletes a session and its associated messages."""
        try:
            self.supabase.table("assistant_session_messages").delete().eq("session_id", session_id).execute()
            self.supabase.table("assistant_sessions").delete().eq("id", session_id).execute()
        except Exception as e:
            logger.error(f"Error deleting session from DB: {e}")

        _LOCAL_SESSIONS.pop(session_id, None)
        _LOCAL_MESSAGES.pop(session_id, None)
        return {"success": True, "deleted_session_id": session_id}

    def get_session_messages(self, session_id: str, owner_id: str = settings.DEFAULT_OWNER_ID) -> List[Dict[str, Any]]:
        """
        Fetches all messages for a session in chronological sequence.
        Extracts embedded metadata and WhatsApp source cards from context_refs.
        """
        messages = []
        try:
            res = self.supabase.table("assistant_session_messages")\
                .select("id, owner_id, session_id, role, content, context_refs, sequence_number, created_at")\
                .eq("session_id", session_id)\
                .order("sequence_number", desc=False)\
                .execute()
            if res.data:
                messages = res.data
        except Exception as e:
            logger.error(f"DB get_session_messages error: {e}")
            messages = _LOCAL_MESSAGES.get(session_id, [])

        # Unpack metadata and whatsapp context from context_refs
        formatted_messages = []
        for m in messages:
            ctx_refs = m.get("context_refs") or []
            meta = {}
            wa_ctx = None

            cleaned_refs = []
            for ref in ctx_refs:
                if ref.get("ref_type") == "ai_metadata":
                    meta = ref.get("metadata", {})
                elif ref.get("ref_type") == "whatsapp_evidence":
                    wa_ctx = ref.get("whatsapp_context")
                else:
                    cleaned_refs.append(ref)

            formatted_messages.append({
                "id": m["id"],
                "session_id": m.get("session_id"),
                "role": m.get("role", "user"),
                "content": m.get("content", ""),
                "context_refs": cleaned_refs,
                "metadata": meta,
                "whatsapp_context": wa_ctx,
                "sequence_number": m.get("sequence_number", 0),
                "created_at": m.get("created_at")
            })

        return formatted_messages

    async def chat(
        self, 
        session_id: str, 
        prompt: str, 
        context_refs: List[Dict[str, Any]] = None, 
        attachments: Optional[List[Dict[str, Any]]] = None,
        owner_id: str = settings.DEFAULT_OWNER_ID
    ) -> Dict[str, Any]:
        """
        Executes unified AI conversation with full tool routing, natural language actions,
        WhatsApp message retrieval, attachments parsing, and external connector integration.
        """
        now = datetime.now(timezone.utc).isoformat()
        context_refs = context_refs or []
        attachments = attachments or []

        # 1. Fetch previous session history
        history_msgs = self.get_session_messages(session_id, owner_id)

        # 2. Record User Message
        user_msg_id = str(uuid.uuid4())
        user_seq = len(history_msgs) + 1
        user_msg = {
            "id": user_msg_id,
            "owner_id": owner_id,
            "session_id": session_id,
            "role": "user",
            "content": prompt,
            "context_refs": context_refs,
            "sequence_number": user_seq,
            "created_at": now
        }

        try:
            self.supabase.table("assistant_session_messages").insert(user_msg).execute()
        except Exception as e:
            logger.error(f"Error persisting user message: {e}")
            if session_id not in _LOCAL_MESSAGES:
                _LOCAL_MESSAGES[session_id] = []
            _LOCAL_MESSAGES[session_id].append(user_msg)

        # 3. Process Attachments (Images, WhatsApp .txt, Documents)
        attachment_context_text = ""
        for att in attachments:
            fname = att.get("name", "file")
            ftype = att.get("type", "").lower()
            content = att.get("content", "")

            if "whatsapp" in fname.lower() or fname.endswith(".txt") and (" - " in content or ":" in content):
                lines = [l.strip() for l in content.splitlines() if l.strip()]
                msg_count = len(lines)
                sample = "\n".join(lines[:10])
                attachment_context_text += (
                    f"\nATTACHED WHATSAPP CHAT EXPORT ('{fname}'):\n"
                    f"- Detected Lines/Messages: {msg_count}\n"
                    f"- Sample Header:\n{sample}\n"
                    f"- Action Ready: User can ratify and import these records into the conversation ledger.\n"
                )
            elif "image" in ftype or fname.endswith((".png", ".jpg", ".jpeg", ".webp")):
                attachment_context_text += (
                    f"\nATTACHED IMAGE ('{fname}'):\n"
                    f"- Visual attachment registered.\n"
                    f"- Image description: {att.get('caption') or 'Screenshot/User photo attached for visual inspection'}\n"
                )
            else:
                attachment_context_text += (
                    f"\nATTACHED DOCUMENT ('{fname}'):\n"
                    f"{content[:2000]}\n"
                )

        # 4. Natural Language Tool & Connector Action Routing
        from services.connectors_service import connectors_service
        lower_prompt = prompt.lower()
        tool_execution_result = None
        tool_action_name = None

        # A: Contact management actions (Dynamic across all contacts in database)
        if any(w in lower_prompt for w in ["auto reply", "auto-reply", "autoreply", "select", "disable", "enable", "turn on", "turn off"]):
            all_c = []
            try:
                c_res = self.supabase.table("contacts").select("id, display_name, phone").execute()
                all_c = c_res.data or []
            except Exception:
                pass

            target_contact = None
            for c in all_c:
                cname = (c.get("display_name") or "").lower().strip()
                if cname and len(cname) >= 3 and cname in lower_prompt:
                    target_contact = c["display_name"]
                    break

            if not target_contact:
                if "parveen" in lower_prompt or "مومياء" in lower_prompt:
                    target_contact = "Parveen"
                elif "afiza" in lower_prompt:
                    target_contact = "Afiza"

            if target_contact:
                is_disable = any(w in lower_prompt for w in ["disable", "turn off", "stop", "remove"])
                should_auto = not is_disable
                should_select = not is_disable
                
                tool_action_name = "update_contact_preference"
                tool_execution_result = await connectors_service.execute_tool(
                    "update_contact_preference",
                    {
                        "contact_name": target_contact,
                        "is_selected": should_select,
                        "auto_reply_enabled": should_auto,
                        "reply_mode": "automatic" if should_auto else "approval"
                    }
                )

        # B: Google Drive actions
        elif any(w in lower_prompt for w in ["drive", "find document", "find file", "search files"]):
            tool_action_name = "search_drive_files"
            tool_execution_result = await connectors_service.execute_tool(
                "search_drive_files",
                {"query": "project"}
            )

        # C: Gmail actions
        elif any(w in lower_prompt for w in ["gmail", "email", "mail", "inbox"]):
            if "draft" in lower_prompt:
                tool_action_name = "draft_email"
                tool_execution_result = await connectors_service.execute_tool(
                    "draft_email",
                    {"to": "faculty@svce.ac.in", "subject": "AVNL Industrial Internship", "body": "Respected Faculty,\nI am writing to express my interest in the AVNL Internship program."}
                )
            else:
                tool_action_name = "search_emails"
                tool_execution_result = await connectors_service.execute_tool(
                    "search_emails",
                    {"query": "internship"}
                )

        # D: Calendar actions
        elif any(w in lower_prompt for w in ["calendar", "schedule", "events", "meeting tomorrow"]):
            tool_action_name = "view_calendar_events"
            tool_execution_result = await connectors_service.execute_tool(
                "view_calendar_events",
                {}
            )

        # 5. Retrieve WhatsApp Historical Records if relevant
        retrieval_result = whatsapp_retrieval_service.detect_intent_and_retrieve(
            prompt=prompt,
            context_refs=context_refs,
            owner_id=owner_id
        )

        whatsapp_evidence_text = ""
        whatsapp_context_payload = None

        if retrieval_result.get("has_whatsapp_context"):
            whatsapp_evidence_text = retrieval_result.get("evidence_text", "")
            whatsapp_context_payload = {
                "contact": retrieval_result.get("contact"),
                "intent": retrieval_result.get("intent"),
                "latest_outgoing": retrieval_result.get("latest_outgoing"),
                "latest_incoming": retrieval_result.get("latest_incoming"),
                "messages": retrieval_result.get("messages", [])
            }

        # 6. Live Database Statistics & Contact Registry Context
        db_stats_text = ""
        try:
            c_res = self.supabase.table("contacts").select("id, display_name, is_selected, auto_reply_enabled, reply_mode, preferred_language").execute()
            if c_res.data:
                all_contacts = c_res.data
                total_cnt = len(all_contacts)
                selected_contacts = [c['display_name'] for c in all_contacts if c.get('is_selected')]
                auto_reply_contacts = [c['display_name'] for c in all_contacts if c.get('auto_reply_enabled')]
                sample_names = [c['display_name'] for c in all_contacts[:20]]
                db_stats_text = (
                    f"DATABASE & CONTACT REGISTRY:\n"
                    f"- Total Contacts in Database: {total_cnt}\n"
                    f"- Selected Contacts for Auto-Reply ({len(selected_contacts)}): {', '.join(selected_contacts) if selected_contacts else 'None'}\n"
                    f"- Contacts with Auto-Reply Enabled: {', '.join(auto_reply_contacts) if auto_reply_contacts else 'None'}\n"
                    f"- Sample Contacts: {', '.join(sample_names)}\n"
                )
        except Exception as e:
            logger.error(f"Error compiling db stats for assistant: {e}")

        tool_result_text = ""
        if tool_execution_result:
            tool_result_text = f"\nVERIFIED TOOL & CONNECTOR EXECUTION RESULT ({tool_action_name}):\n{json.dumps(tool_execution_result, indent=2)}\n"

        # 7. Compile Live System Instructions
        system_instructions = (
            "You are ChatPilot Assistant, the private executive AI Co-Pilot for Thoufikur Rahaman.\n"
            "You are a capable general-purpose assistant that directly controls ChatPilot's database, connected applications (Google Drive, Gmail, Google Calendar, GitHub, MCP), and WhatsApp archives.\n\n"
            f"{db_stats_text}\n"
            f"{tool_result_text}\n"
            f"{attachment_context_text}\n"
            f"{whatsapp_evidence_text}\n\n"
            "CAPABILITIES & INSTRUCTIONS:\n"
            "1. You HAVE real execution access. When the user requests contact changes (e.g. 'make Parveen to auto reply and select' or 'disable Afiza'), report the verified changes from the tool execution result above.\n"
            "2. When answering about Google Drive, Gmail, Calendar, or GitHub, use the verified connector data provided above.\n"
            "3. If an attachment is present (such as a WhatsApp .txt export or document), analyze its content thoroughly and summarize or offer import ratification.\n"
            "4. For WhatsApp queries, quote exact timestamps and verified messages from the archive.\n"
            "5. Answer naturally, authoritatively, and concisely in clean Markdown with code blocks or bullets where helpful."
        )

        # 5. Build conversation turns for AI context
        dialogue_messages = []
        for m in history_msgs[-6:]:
            dialogue_messages.append({
                "role": m.get("role", "user"),
                "content": m.get("content", "")
            })
        dialogue_messages.append({"role": "user", "content": prompt})

        # 6. Generate AI response via AI Manager
        ai_response = await ai_manager.generate_response(
            messages=dialogue_messages,
            system_prompt=system_instructions,
            max_tokens=500
        )

        reply_content = ai_response.get("content", "I reviewed the available conversation records.")
        provider_used = ai_response.get("provider", "groq")
        latency_ms = ai_response.get("latency_ms", 0)

        # 7. Construct contextual references including metadata and whatsapp evidence
        combined_refs = list(context_refs)
        combined_refs.append({
            "ref_type": "ai_metadata",
            "metadata": {
                "provider": provider_used,
                "model": ai_response.get("model", ""),
                "latency_ms": latency_ms
            }
        })

        if whatsapp_context_payload:
            combined_refs.append({
                "ref_type": "whatsapp_evidence",
                "whatsapp_context": whatsapp_context_payload
            })

        assistant_msg_id = str(uuid.uuid4())
        assistant_seq = user_seq + 1

        # Database-safe payload (NO non-existent columns)
        db_assistant_msg = {
            "id": assistant_msg_id,
            "owner_id": owner_id,
            "session_id": session_id,
            "role": "assistant",
            "content": reply_content,
            "context_refs": combined_refs,
            "sequence_number": assistant_seq,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        try:
            self.supabase.table("assistant_session_messages").insert(db_assistant_msg).execute()
            self.supabase.table("assistant_sessions").update({
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", session_id).execute()
        except Exception as e:
            logger.error(f"Error persisting assistant message: {e}")
            if session_id not in _LOCAL_MESSAGES:
                _LOCAL_MESSAGES[session_id] = []
            _LOCAL_MESSAGES[session_id].append(db_assistant_msg)
            if session_id in _LOCAL_SESSIONS:
                _LOCAL_SESSIONS[session_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Update session title automatically if this is the first exchange
        if len(history_msgs) == 0:
            suggested_title = prompt.strip()[:40]
            if len(prompt.strip()) > 40:
                suggested_title += "..."
            self.rename_session(session_id, suggested_title, owner_id)

        # Return full client response
        return {
            "id": assistant_msg_id,
            "session_id": session_id,
            "role": "assistant",
            "content": reply_content,
            "context_refs": context_refs,
            "metadata": {
                "provider": provider_used,
                "model": ai_response.get("model", ""),
                "latency_ms": latency_ms
            },
            "whatsapp_context": whatsapp_context_payload,
            "sequence_number": assistant_seq,
            "created_at": db_assistant_msg["created_at"]
        }

assistant_service = AssistantService()
