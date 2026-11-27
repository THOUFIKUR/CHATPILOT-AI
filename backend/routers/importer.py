from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.importer_service import importer_service

router = APIRouter(prefix="/api/import", tags=["import"])

class ImportExecuteRequest(BaseModel):
    messages: List[Dict[str, Any]]
    user_sender_name: str
    contact_display_name: str
    phone_or_jid: Optional[str] = None

@router.post("/preview")
async def preview_import(file: UploadFile = File(...)):
    if not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only WhatsApp .txt export files are supported")
    
    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = content_bytes.decode("latin-1")

    messages = importer_service.parse_txt(content)
    if not messages:
        raise HTTPException(status_code=400, detail="No readable messages found in text file")

    preview = importer_service.analyze_preview(messages)
    preview["parsed_messages"] = messages
    return preview

@router.post("/execute")
async def execute_import(req: ImportExecuteRequest):
    try:
        result = await importer_service.execute_import(
            messages=req.messages,
            user_sender_name=req.user_sender_name,
            contact_display_name=req.contact_display_name,
            phone_or_jid=req.phone_or_jid
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
