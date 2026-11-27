from fastapi import APIRouter, Query, HTTPException
from database import get_supabase

router = APIRouter(prefix="/api", tags=["conversations"])

@router.get("/conversations")
async def get_conversations():
    res = get_supabase().table("conversations").select("*, contacts(*)").order("updated_at", desc=True).execute()
    return res.data or []

@router.get("/messages")
async def get_messages(conversation_id: str = Query(...)):
    res = get_supabase().table("messages")\
        .select("*")\
        .eq("conversation_id", conversation_id)\
        .order("created_at", desc=False)\
        .limit(100)\
        .execute()
    return res.data or []
