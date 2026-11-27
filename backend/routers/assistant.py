from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from services.assistant_service import assistant_service

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

class CreateSessionRequest(BaseModel):
    title: str = "New Inquest"

class RenameSessionRequest(BaseModel):
    title: str

class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    message: Optional[str] = None
    context_refs: List[Dict[str, Any]] = []
    attachments: Optional[List[Dict[str, Any]]] = []
    provider: Optional[str] = None
    model: Optional[str] = None
    contact_filter: Optional[str] = None

@router.get("/sessions")
def get_sessions():
    return assistant_service.list_sessions()

@router.post("/sessions")
def create_session(req: CreateSessionRequest):
    return assistant_service.create_session(title=req.title)

@router.patch("/sessions/{session_id}")
def rename_session(session_id: str, req: RenameSessionRequest):
    return assistant_service.rename_session(session_id=session_id, new_title=req.title)

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    return assistant_service.delete_session(session_id=session_id)

@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: str):
    return assistant_service.get_session_messages(session_id)

@router.post("/sessions/{session_id}/chat")
@router.post("/sessions/{session_id}/messages")
async def send_chat(session_id: str, req: ChatRequest):
    user_prompt = (req.prompt or req.message or "").strip()
    if not user_prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    # If contact_filter provided, add to context_refs
    refs = list(req.context_refs or [])
    if req.contact_filter and req.contact_filter != "all":
        refs.append({"type": "contact", "name": req.contact_filter})

    res = await assistant_service.chat(
        session_id=session_id,
        prompt=user_prompt,
        context_refs=refs,
        attachments=req.attachments or []
    )
    return {
        "reply": res.get("content", ""),
        "content": res.get("content", ""),
        "assistant_message": res,
        **res
    }
