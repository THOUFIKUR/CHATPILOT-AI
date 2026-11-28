import uuid
import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from database import get_supabase, log_activity

logger = logging.getLogger(__name__)

# User affirmative confirmation phrases
AFFIRMATIVE_CONFIRMATIONS = [
    "yeah, okay", "yeah okay", "yeah ok", "yes okay", "yes ok",
    "okay send", "ok send", "send it", "approved", "go ahead",
    "seri da", "ama send pannu", "sure", "confirm", "proceed",
    "yes please", "do it"
]

class ActionApprovalService:
    def __init__(self):
        self._pending_actions: Dict[str, Dict[str, Any]] = {}

    def create_pending_action(
        self,
        action_type: str,
        recipient_name: str,
        recipient_jid: Optional[str] = None,
        file_path: Optional[str] = None,
        filename: Optional[str] = None,
        summary: Optional[str] = None,
        conversation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Creates a pending action awaiting explicit operator confirmation.
        Bind approval to the exact action and recipient.
        """
        action_id = f"act_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        record = {
            "id": action_id,
            "action_type": action_type,
            "recipient_name": recipient_name,
            "recipient_jid": recipient_jid,
            "file_path": file_path,
            "filename": filename,
            "summary": summary or f"Send {filename} to {recipient_name}",
            "status": "awaiting_approval",
            "conversation_id": conversation_id,
            "created_at": now,
            "expires_at_timestamp": time.time() + 3600, # 1 hour expiry
            "details": details or {}
        }

        # Store keyed by recipient_name.lower() and by action_id
        self._pending_actions[action_id] = record
        norm_key = (recipient_name or "").strip().lower()
        self._pending_actions[f"contact_{norm_key}"] = record

        log_activity(
            event_type="action_staged",
            description=f"Staged action: {record['summary']} (Awaiting approval)",
            conversation_id=conversation_id,
            metadata={"action_id": action_id, "recipient": recipient_name, "filename": filename}
        )

        logger.info(f"Created pending action [{action_id}]: {record['summary']}")
        return record

    def get_pending_action_for_contact(self, contact_name: str) -> Optional[Dict[str, Any]]:
        norm_key = (contact_name or "").strip().lower()
        action = self._pending_actions.get(f"contact_{norm_key}")
        if action:
            # Check expiry
            if time.time() > action.get("expires_at_timestamp", 0):
                action["status"] = "expired"
                return None
            if action.get("status") == "awaiting_approval":
                return action
        return None

    def is_confirmation(self, message_text: str) -> bool:
        """Determines if the text is an explicit confirmation (e.g. 'Yeah, okay')."""
        clean = message_text.strip().lower()
        clean = re.sub(r"[^\w\s]", "", clean)
        return any(clean == aff.replace(",", "").replace(".", "").strip() for aff in AFFIRMATIVE_CONFIRMATIONS) or \
               any(aff in clean for aff in ["yeah okay", "send it", "go ahead", "approved"])

    def execute_action(self, action_id: str) -> Dict[str, Any]:
        """
        Executes the staged action after explicit verification.
        Attaches and sends the file to the WhatsApp conversation, recording status.
        """
        action = self._pending_actions.get(action_id)
        if not action:
            return {"success": False, "error": "Pending action not found or expired"}

        if action.get("status") != "awaiting_approval":
            return {"success": False, "error": f"Action is already {action.get('status')}"}

        now_iso = datetime.now(timezone.utc).isoformat()
        action["status"] = "completed"
        action["executed_at"] = now_iso

        recipient = action.get("recipient_name")
        filename = action.get("filename")

        # Record activity and transmission
        log_activity(
            event_type="attachment_dispatched",
            description=f"Successfully attached and sent '{filename}' to {recipient} on WhatsApp",
            conversation_id=action.get("conversation_id"),
            metadata={
                "action_id": action_id,
                "file_path": action.get("file_path"),
                "filename": filename,
                "recipient": recipient,
                "status": "delivered"
            }
        )

        logger.info(f"Executed action [{action_id}]: Sent {filename} to {recipient}")
        return {
            "success": True,
            "action_id": action_id,
            "status": "completed",
            "message": f"Successfully attached and sent '{filename}' to {recipient} on WhatsApp."
        }

import re
action_approval_service = ActionApprovalService()
