from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from config import settings
from services.style_service import style_service

router = APIRouter(prefix="/api/memory", tags=["memory"])
supabase = get_supabase()

class MemoryCreate(BaseModel):
    contact_id: Optional[str] = None
    group_id: Optional[str] = None
    memory_key: str
    memory_value: str
    confidence: Optional[float] = 1.0

@router.get("")
async def get_memory(contact_id: Optional[str] = None):
    query = supabase.table("contact_memory").select("*")
    if contact_id:
        query = query.eq("contact_id", contact_id)
    res = query.order("created_at", desc=True).execute()
    return res.data or []

@router.post("")
async def create_memory(data: MemoryCreate):
    m_data = data.dict()
    m_data["owner_id"] = settings.DEFAULT_OWNER_ID
    res = supabase.table("contact_memory").insert(m_data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to save memory")
    return res.data[0]

@router.delete("/{memory_id}")
async def delete_memory(memory_id: str):
    supabase.table("contact_memory").delete().eq("id", memory_id).execute()
    return {"success": True, "id": memory_id}

@router.get("/style/{contact_id}")
async def get_contact_style(contact_id: str):
    style_data = style_service.get_contact_style(contact_id)
    return style_data
