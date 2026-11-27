from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_supabase
from config import settings

router = APIRouter(prefix="/api/groups", tags=["groups"])

class GroupCreate(BaseModel):
    group_name: str
    whatsapp_jid: Optional[str] = None
    is_selected: bool = True
    auto_reply_enabled: bool = False
    reply_mode: str = "approval"
    trigger_mode: Optional[str] = "mention"

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
    data = group.dict()
    data["owner_id"] = settings.DEFAULT_OWNER_ID
    if not data.get("whatsapp_jid"):
        data["whatsapp_jid"] = f"{data['group_name'].lower().replace(' ', '')}@g.us"
    res = get_supabase().table("chatpilot_groups").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create group")
    return res.data[0]

@router.put("/{group_id}")
async def update_group(group_id: str, updates: GroupUpdate):
    data = {k: v for k, v in updates.dict().items() if v is not None}
    res = get_supabase().table("chatpilot_groups").update(data).eq("id", group_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return res.data[0]
