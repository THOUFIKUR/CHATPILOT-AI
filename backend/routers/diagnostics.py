from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_supabase, log_activity
from config import settings
from services.reply_service import reply_engine

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])

class SimulateRequest(BaseModel):
    sender_name: str
    message: str
    contact_id: Optional[str] = None
    conversation_id: Optional[str] = None

@router.get("")
async def get_diagnostics():
    # Fetch recent activity, events, and provider metrics
    events_res = get_supabase().table("activity_logs").select("*").order("created_at", desc=True).limit(20).execute()
    devices_res = get_supabase().table("devices").select("*").execute()
    return {
        "status": "online",
        "service": "ChatPilot AI Engine",
        "recent_activities": events_res.data or [],
        "devices": devices_res.data or []
    }

@router.post("/simulate")
async def simulate_incoming_message(req: SimulateRequest):
    """Simulates an incoming WhatsApp notification event."""
    try:
        # Record integration event
        get_supabase().table("integration_events").insert({
            "owner_id": settings.DEFAULT_OWNER_ID,
            "source": "windows_simulator",
            "event_type": "whatsapp_incoming_message",
            "processing_status": "received",
            "safe_metadata": {"sender": req.sender_name, "preview": req.message[:50]}
        }).execute()

        res = await reply_engine.process_incoming_message(
            sender_name=req.sender_name,
            message_body=req.message,
            contact_id=req.contact_id,
            conversation_id=req.conversation_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
