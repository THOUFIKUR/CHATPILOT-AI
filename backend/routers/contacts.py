import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import get_supabase
from config import settings
from utils.phone_utils import normalize_phone, match_phone

router = APIRouter(prefix="/api/contacts", tags=["contacts"])

class ContactCreate(BaseModel):
    display_name: str
    phone_e164: Optional[str] = None
    whatsapp_jid: Optional[str] = None
    is_selected: bool = False
    auto_reply_enabled: bool = False
    reply_mode: str = "approval"
    preferred_language: str = "Auto"
    reply_delay: Optional[int] = 2
    custom_instructions: Optional[str] = None
    safety_status: Optional[str] = "nominal"
    notes: Optional[str] = None

class ContactUpdate(BaseModel):
    display_name: Optional[str] = None
    phone_e164: Optional[str] = None
    whatsapp_jid: Optional[str] = None
    is_selected: Optional[bool] = None
    auto_reply_enabled: Optional[bool] = None
    reply_mode: Optional[str] = None
    preferred_language: Optional[str] = None
    reply_delay: Optional[int] = None
    custom_instructions: Optional[str] = None
    safety_status: Optional[str] = None
    notes: Optional[str] = None

def parse_contact_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts custom fields like custom_instructions and reply_delay from notes if stored as json."""
    c = dict(raw)
    notes_val = c.get("notes") or ""
    if notes_val.startswith("{") and notes_val.endswith("}"):
        try:
            parsed = json.loads(notes_val)
            if "custom_instructions" in parsed:
                c["custom_instructions"] = parsed["custom_instructions"]
            if "reply_delay" in parsed:
                c["reply_delay"] = parsed["reply_delay"]
            if "safety_status" in parsed:
                c["safety_status"] = parsed["safety_status"]
            if "user_notes" in parsed:
                c["notes"] = parsed["user_notes"]
        except Exception:
            pass
    if "reply_delay" not in c or c["reply_delay"] is None:
        c["reply_delay"] = 2
    if "safety_status" not in c or not c["safety_status"]:
        c["safety_status"] = "nominal"
    return c

@router.get("")
async def get_contacts():
    sb = get_supabase()
    res = sb.table("contacts").select("*").order("created_at", desc=True).execute()
    data = res.data or []
    return [parse_contact_record(c) for c in data]

@router.post("")
async def create_contact(contact: ContactCreate):
    sb = get_supabase()
    data = contact.dict()
    data["owner_id"] = settings.DEFAULT_OWNER_ID
    if data.get("phone_e164"):
        norm_phone = normalize_phone(data["phone_e164"])
        data["phone_e164"] = norm_phone
        # Duplicate prevention check across normalized phones
        if norm_phone:
            existing_p = sb.table("contacts").select("id, display_name, phone_e164").execute().data or []
            for ep in existing_p:
                if match_phone(ep.get("phone_e164"), norm_phone):
                    logger.info(f"Contact with matching phone already exists: {ep['display_name']} ({ep.get('phone_e164')})")
                    return parse_contact_record(ep)

    if not data.get("whatsapp_jid") and data.get("display_name"):
        data["whatsapp_jid"] = f"{data['display_name'].lower().replace(' ', '')}@s.whatsapp.net"

    if data.get("reply_mode") == "autonomous":
        data["reply_mode"] = "automatic"

    # Pack extra fields into notes JSON safely
    notes_pack = {
        "user_notes": data.get("notes") or "",
        "custom_instructions": data.pop("custom_instructions", None),
        "reply_delay": data.pop("reply_delay", 2),
        "safety_status": data.pop("safety_status", "nominal")
    }
    data["notes"] = json.dumps(notes_pack)

    res = sb.table("contacts").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create contact")
    return parse_contact_record(res.data[0])

@router.put("/{contact_id}")
async def update_contact(contact_id: str, updates: ContactUpdate):
    sb = get_supabase()
    # Fetch existing
    cur = sb.table("contacts").select("*").eq("id", contact_id).execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    current_rec = cur.data[0]
    parsed_cur = parse_contact_record(current_rec)

    update_dict = {k: v for k, v in updates.dict().items() if v is not None}

    if update_dict.get("reply_mode") == "autonomous":
        update_dict["reply_mode"] = "automatic"

    if "phone_e164" in update_dict and update_dict["phone_e164"]:
        update_dict["phone_e164"] = normalize_phone(update_dict["phone_e164"])

    # Extract extra fields
    custom_inst = update_dict.pop("custom_instructions", parsed_cur.get("custom_instructions"))
    delay_val = update_dict.pop("reply_delay", parsed_cur.get("reply_delay", 2))
    safety_val = update_dict.pop("safety_status", parsed_cur.get("safety_status", "nominal"))
    notes_val = update_dict.pop("notes", parsed_cur.get("notes", ""))

    notes_pack = {
        "user_notes": notes_val,
        "custom_instructions": custom_inst,
        "reply_delay": delay_val,
        "safety_status": safety_val
    }
    update_dict["notes"] = json.dumps(notes_pack)

    res = sb.table("contacts").update(update_dict).eq("id", contact_id).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to update contact")
    return parse_contact_record(res.data[0])

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    sb = get_supabase()
    res = sb.table("contacts").delete().eq("id", contact_id).execute()
    return {"success": True, "id": contact_id}
