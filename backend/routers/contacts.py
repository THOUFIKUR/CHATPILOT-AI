import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import get_supabase
from config import settings
from utils.phone_utils import normalize_phone_e164, phones_match

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

    # Normalize phone to E.164 (handles Saudi Arabia +966 and India +91)
    if data.get("phone_e164"):
        norm_phone = normalize_phone_e164(data["phone_e164"])
        data["phone_e164"] = norm_phone
        if not data.get("whatsapp_jid"):
            data["whatsapp_jid"] = f"{norm_phone.lstrip('+')}@s.whatsapp.net"

        # Check for existing contact by phone to prevent duplicates
        existing = sb.table("contacts").select("*").eq("phone_e164", norm_phone).execute()
        if existing.data:
            c_id = existing.data[0]["id"]
            upd_data = {
                "display_name": data.get("display_name") or existing.data[0]["display_name"],
                "is_selected": data.get("is_selected", existing.data[0]["is_selected"]),
                "auto_reply_enabled": data.get("auto_reply_enabled", existing.data[0]["auto_reply_enabled"]),
                "reply_mode": data.get("reply_mode", existing.data[0]["reply_mode"])
            }
            sb.table("contacts").update(upd_data).eq("id", c_id).execute()
            updated_res = sb.table("contacts").select("*").eq("id", c_id).execute()
            return parse_contact_record(updated_res.data[0])

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

    if "phone_e164" in update_dict and update_dict["phone_e164"]:
        update_dict["phone_e164"] = normalize_phone_e164(update_dict["phone_e164"])

    if update_dict.get("reply_mode") == "autonomous":
        update_dict["reply_mode"] = "automatic"

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
