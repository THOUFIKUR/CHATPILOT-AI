from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import get_supabase
from config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/groups", tags=["groups"])

class GroupCreate(BaseModel):
    group_name: str
    whatsapp_jid: Optional[str] = None
    is_selected: bool = True
    auto_reply_enabled: bool = False
    reply_mode: str = "approval"
    trigger_mode: Optional[str] = "mention_only"
    notes: Optional[str] = None

class GroupUpdate(BaseModel):
    group_name: Optional[str] = None
    is_selected: Optional[bool] = None
    auto_reply_enabled: Optional[bool] = None
    reply_mode: Optional[str] = None
    trigger_mode: Optional[str] = None
    notes: Optional[str] = None

def _sanitize_group_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitizes group modes to match PostgreSQL constraints strictly."""
    # reply_mode constraint: 'approval' or 'automatic'
    rm = str(data.get("reply_mode", "")).strip().lower()
    if rm in ("automatic", "auto", "autonomous"):
        data["reply_mode"] = "automatic"
    else:
        data["reply_mode"] = "approval"

    # trigger_mode constraint: 'mention_only' or 'all_messages'
    tm = str(data.get("trigger_mode", "")).strip().lower()
    if tm in ("all", "all_messages", "every"):
        data["trigger_mode"] = "all_messages"
    else:
        data["trigger_mode"] = "mention_only"
        
    return data

@router.get("")
async def get_groups():
    res = get_supabase().table("chatpilot_groups").select("*").order("created_at", desc=True).execute()
    return res.data or []

@router.post("")
async def create_group(group: GroupCreate):
    data = group.dict()
    data["owner_id"] = settings.DEFAULT_OWNER_ID
    # Remove notes if present as chatpilot_groups table does not have notes column
    data.pop("notes", None)
    if not data.get("whatsapp_jid"):
        clean_jid = "".join(c for c in data['group_name'].lower() if c.isalnum() or c in ('_', '-'))
        data["whatsapp_jid"] = f"{clean_jid or 'group'}@g.us"

    _sanitize_group_data(data)

    res = get_supabase().table("chatpilot_groups").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create group record")
    return res.data[0]

@router.put("/{group_id}")
async def update_group(group_id: str, updates: GroupUpdate):
    data = {k: v for k, v in updates.dict().items() if v is not None}
    data.pop("notes", None)
    if "reply_mode" in data or "trigger_mode" in data:
        _sanitize_group_data(data)

    res = get_supabase().table("chatpilot_groups").update(data).eq("id", group_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return res.data[0]

@router.delete("/{group_id}")
async def delete_group(group_id: str):
    res = get_supabase().table("chatpilot_groups").delete().eq("id", group_id).execute()
    return {"success": True, "deleted_id": group_id}
