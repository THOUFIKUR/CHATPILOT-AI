from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
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
    reply_mode: str = "approval"        # "approval" or "automatic"
    trigger_mode: str = "mention_only"  # "mention_only" or "all_messages"

class GroupUpdate(BaseModel):
    group_name: Optional[str] = None
    is_selected: Optional[bool] = None
    auto_reply_enabled: Optional[bool] = None
    reply_mode: Optional[str] = None
    trigger_mode: Optional[str] = None

@router.get("")
async def get_groups():
    res = get_supabase().table("chatpilot_groups").select("*").order("created_at", desc=True).execute()
    return res.data or []

@router.post("")
async def create_group(group: GroupCreate):
    sb = get_supabase()
    data = group.dict()
    data["owner_id"] = settings.DEFAULT_OWNER_ID

    clean_name = data["group_name"].strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Group name cannot be empty")
    data["group_name"] = clean_name

    if not data.get("whatsapp_jid"):
        data["whatsapp_jid"] = f"{clean_name.lower().replace(' ', '')}@g.us"

    # Enforce database check constraints:
    # 1. reply_mode in ('approval', 'automatic')
    if data.get("reply_mode") not in ("approval", "automatic"):
        data["reply_mode"] = "approval"
    # 2. trigger_mode in ('mention_only', 'all_messages')
    if data.get("trigger_mode") not in ("mention_only", "all_messages"):
        data["trigger_mode"] = "mention_only"

    # Check if group already exists to prevent duplicate
    existing = sb.table("chatpilot_groups").select("*").or_(f"whatsapp_jid.eq.{data['whatsapp_jid']},group_name.eq.{clean_name}").execute()
    if existing.data:
        g_id = existing.data[0]["id"]
        upd = sb.table("chatpilot_groups").update({
            "is_selected": data.get("is_selected", True),
            "auto_reply_enabled": data.get("auto_reply_enabled", False),
            "reply_mode": data.get("reply_mode", "approval"),
            "trigger_mode": data.get("trigger_mode", "mention_only")
        }).eq("id", g_id).execute()
        return upd.data[0]

    res = sb.table("chatpilot_groups").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create group")
    return res.data[0]

@router.put("/{group_id}")
async def update_group(group_id: str, updates: GroupUpdate):
    data = {k: v for k, v in updates.dict().items() if v is not None}
    if "reply_mode" in data and data["reply_mode"] not in ("approval", "automatic"):
        data["reply_mode"] = "approval"
    if "trigger_mode" in data and data["trigger_mode"] not in ("mention_only", "all_messages"):
        data["trigger_mode"] = "mention_only"

    res = get_supabase().table("chatpilot_groups").update(data).eq("id", group_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return res.data[0]

@router.delete("/{group_id}")
async def delete_group(group_id: str):
    res = get_supabase().table("chatpilot_groups").delete().eq("id", group_id).execute()
    return {"success": True, "deleted": group_id}
