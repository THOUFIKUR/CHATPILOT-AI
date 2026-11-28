from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import get_supabase, log_activity
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/replies", tags=["replies"])

class ApproveRequest(BaseModel):
    id: Optional[str] = None
    edited_text: Optional[str] = None

class RejectRequest(BaseModel):
    id: Optional[str] = None
    reason: Optional[str] = "operator_rejected"

class RegenerateRequest(BaseModel):
    id: Optional[str] = None

@router.get("")
async def get_replies(status: Optional[str] = None):
    """
    Returns verified, rich reply drafts with full incoming message, 
    contact identity, avatar initials, and provider metadata.
    """
    try:
        query = get_supabase().table("reply_drafts").select("*, conversations(*, contacts(*))")
        if status:
            query = query.eq("status", status)
        res = query.order("created_at", desc=True).execute()
        raw_drafts = res.data or []

        # Collect source message IDs to batch-fetch incoming messages
        source_msg_ids = [d["source_message_id"] for d in raw_drafts if d.get("source_message_id")]
        msg_map = {}
        if source_msg_ids:
            # Batch in chunks of 50
            for i in range(0, len(source_msg_ids), 50):
                chunk = source_msg_ids[i:i+50]
                m_res = get_supabase().table("messages").select("id, body, created_at, sender_name, direction").in_("id", chunk).execute()
                for m in (m_res.data or []):
                    msg_map[m["id"]] = m

        formatted_replies = []
        for d in raw_drafts:
            conv = d.get("conversations") or {}
            contact = conv.get("contacts") or {}
            
            # Resolve actual contact name
            contact_name = contact.get("display_name") or conv.get("title") or "Unknown contact"
            phone = contact.get("phone_e164")
            
            # Resolve source message
            s_id = d.get("source_message_id")
            source_msg = msg_map.get(s_id)
            incoming_body = source_msg.get("body") if source_msg else None
            incoming_time = source_msg.get("created_at") if source_msg else d.get("created_at")
            source_sender = (source_msg.get("sender_name") or "").strip().lower() if source_msg else ""
            source_direction = (source_msg.get("direction") or "").strip().lower() if source_msg else ""

            # Strict Quarantine: Never display drafts triggered by outgoing/self messages
            if source_direction == "outgoing" or source_sender in ("you", "me", "self", "thoufikur", "thoufikur rahman", "thoufikur rahaman"):
                continue
            if contact_name.strip().lower() in ("you", "me", "self", "thoufikur", "thoufikur rahman", "thoufikur rahaman"):
                continue
            
            draft_text = d.get("draft_text") or ""
            
            formatted_replies.append({
                "id": d["id"],
                "owner_id": d.get("owner_id"),
                "conversation_id": d.get("conversation_id"),
                "source_message_id": s_id,
                "contact_id": contact.get("id"),
                "sender_name": contact_name,
                "contact_name": contact_name,
                "phone_number": phone,
                "incoming_message": incoming_body,
                "incoming_timestamp": incoming_time,
                "draft_text": draft_text,
                "provider_name": d.get("provider_name") or "groq",
                "model_name": d.get("model_name") or "qwen/qwen3.8-27b",
                "status": d.get("status", "pending"),
                "approved_at": d.get("approved_at"),
                "sent_at": d.get("sent_at"),
                "send_result": d.get("send_result") or {},
                "created_at": d.get("created_at"),
                "updated_at": d.get("updated_at")
            })

        return formatted_replies
    except Exception as e:
        logger.error(f"Error fetching replies: {e}", exc_info=True)
        return []

@router.post("/approve")
@router.post("/{reply_id}/approve")
async def approve_reply(req: Optional[ApproveRequest] = None, reply_id: Optional[str] = None):
    target_id = (req.id if req else None) or reply_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing reply ID")
        
    draft_res = get_supabase().table("reply_drafts").select("*").eq("id", target_id).execute()
    if not draft_res.data:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = draft_res.data[0]
    final_text = ((req.edited_text if req else None) or draft["draft_text"] or "").strip()
    if not final_text:
        raise HTTPException(status_code=400, detail="Cannot approve an empty draft")

    now_iso = datetime.utcnow().isoformat()
    # Update draft to approved
    upd = get_supabase().table("reply_drafts").update({
        "draft_text": final_text,
        "status": "approved",
        "approved_at": now_iso,
        "sent_at": now_iso,
        "send_result": {"status": "sent_via_bridge", "timestamp": now_iso}
    }).eq("id", target_id).execute()

    # Insert into conversation messages as outgoing message
    get_supabase().table("messages").insert({
        "owner_id": draft["owner_id"],
        "conversation_id": draft["conversation_id"],
        "direction": "outgoing",
        "sender_name": "Thoufikur Rahman",
        "body": final_text,
        "source": "manual"
    }).execute()

    log_activity(
        event_type="reply_approved",
        description=f"Approved & sent reply: \"{final_text[:40]}...\"",
        conversation_id=draft["conversation_id"],
        metadata={"reply_text": final_text, "draft_id": target_id}
    )

    return {"success": True, "draft": upd.data[0]}

@router.post("/reject")
@router.post("/{reply_id}/reject")
async def reject_reply(req: Optional[RejectRequest] = None, reply_id: Optional[str] = None):
    target_id = (req.id if req else None) or reply_id
    reason = req.reason if req else "operator_rejected"
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing reply ID")

    upd = get_supabase().table("reply_drafts").update({
        "status": "rejected",
        "send_result": {"reason": reason}
    }).eq("id", target_id).execute()
    if not upd.data:
        raise HTTPException(status_code=404, detail="Draft not found")

    log_activity(
        event_type="reply_rejected",
        description="Rejected draft reply",
        conversation_id=upd.data[0].get("conversation_id"),
        metadata={"draft_id": target_id, "reason": reason}
    )
    return {"success": True, "draft": upd.data[0]}

@router.post("/regenerate")
@router.post("/{reply_id}/regenerate")
async def regenerate_reply(req: Optional[RegenerateRequest] = None, reply_id: Optional[str] = None):
    """Regenerates an AI reply draft for the same incoming message without creating a duplicate record."""
    from services.ai_manager import ai_manager
    from services.style_service import style_service

    target_id = (req.id if req else None) or reply_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing reply ID")

    draft_res = get_supabase().table("reply_drafts").select("*, conversations(*, contacts(*))").eq("id", target_id).execute()
    if not draft_res.data:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    draft = draft_res.data[0]
    conv = draft.get("conversations") or {}
    contact = conv.get("contacts") or {}
    contact_id = contact.get("id")
    s_id = draft.get("source_message_id")
    
    if not s_id:
        raise HTTPException(status_code=400, detail="Cannot regenerate draft without verified source message")
        
    msg_res = get_supabase().table("messages").select("*").eq("id", s_id).execute()
    if not msg_res.data:
        raise HTTPException(status_code=404, detail="Original source message not found")
        
    incoming_text = msg_res.data[0]["body"]
    sender_name = contact.get("display_name") or msg_res.data[0].get("sender_name") or "Friend"
    
    style_info = style_service.get_contact_style(contact_id) if contact_id else {}
    
    prompt = f"""You are ChatPilot AI, acting as Thoufikur Rahman in a personal WhatsApp conversation.
Reply to {sender_name} naturally, accurately, and concisely.
Language: {style_info.get('detected_languages', ['Auto'])[0]}
Tone: {style_info.get('tone', 'Casual & friendly')}
Strict WhatsApp chat style: brief, natural, 1-2 sentences."""

    ai_res = await ai_manager.generate_response(
        messages=[{"role": "user", "content": incoming_text}],
        system_prompt=prompt,
        temperature=0.7,
        max_tokens=150
    )
    new_text = ai_res.get("content", "").strip()
    if not new_text:
        raise HTTPException(status_code=500, detail="AI generation returned empty response")
        
    now_iso = datetime.utcnow().isoformat()
    upd = get_supabase().table("reply_drafts").update({
        "draft_text": new_text,
        "provider_name": ai_res.get("provider", "groq"),
        "model_name": ai_res.get("model", "qwen/qwen3.8-27b"),
        "updated_at": now_iso
    }).eq("id", target_id).execute()
    
    log_activity(
        event_type="draft_updated",
        description=f"Regenerated draft reply for {sender_name}",
        conversation_id=draft.get("conversation_id"),
        metadata={
            "incoming_message": incoming_text,
            "reply_text": new_text,
            "draft_text": new_text,
            "contact": sender_name,
            "provider": ai_res.get("provider")
        }
    )
    
    return {"success": True, "draft": upd.data[0]}
