from fastapi import APIRouter
from database import get_supabase
from config import settings
from typing import Dict, Any

router = APIRouter(prefix="/api", tags=["settings"])

@router.get("/settings")
async def get_settings():
    res = get_supabase().table("app_settings").select("*").execute()
    if res.data and res.data[0].get("settings"):
        st = res.data[0]["settings"]
        # Ensure default reply delay is 2 and auto_reply is present
        if "auto_reply" not in st:
            st["auto_reply"] = False
        if "reply_delay_seconds" not in st:
            st["reply_delay_seconds"] = 2
        st["daily_cap_removed"] = True
        return st
    return {
        "auto_reply": False,
        "reply_delay_seconds": 2,
        "reply_delay_min": 2,
        "reply_delay_max": 2,
        "account_safety_status": "nominal",
        "default_language": "Tanglish / English",
        "theme": "Atelier Terminal",
        "user_name": "Thoufikur Rahman",
        "daily_cap_removed": True,
        "notification_enabled": True
    }

@router.post("/settings")
async def update_settings(new_settings: Dict[str, Any]):
    existing = get_supabase().table("app_settings").select("*").execute()
    new_settings["daily_cap_removed"] = True
    if existing.data:
        res = get_supabase().table("app_settings").update({"settings": new_settings}).eq("id", existing.data[0]["id"]).execute()
        return res.data[0]["settings"]
    else:
        res = get_supabase().table("app_settings").insert({
            "owner_id": settings.DEFAULT_OWNER_ID,
            "settings": new_settings
        }).execute()
        return res.data[0]["settings"]

@router.get("/auto-reply/status")
async def get_auto_reply_status():
    from services.parveen_experiment_service import parveen_experiment_service
    settings_data = await get_settings()
    is_on = bool(settings_data.get("auto_reply", False))
    
    status_label = "ARMED // ACTIVE" if is_on else "AUTO-REPLY PAUSED"
    description = (
        "Automatic WhatsApp replies are active for explicitly authorized contacts."
        if is_on else
        "Your contact preferences are saved, but automatic WhatsApp replies are currently paused. Enable Global Auto-Reply when you are ready."
    )

    return {
        "auto_reply_enabled": is_on,
        "status_label": status_label,
        "description": description,
        "account_safety_status": settings_data.get("account_safety_status", "nominal"),
        "reply_delay_seconds": int(settings_data.get("reply_delay_seconds", 2)),
        "daily_cap_removed": True,
        "selected_contacts_active": is_on,
        "experiment_status": parveen_experiment_service.get_status()
    }

@router.post("/auto-reply/toggle")
async def toggle_auto_reply(payload: Dict[str, Any]):
    from services.parveen_experiment_service import parveen_experiment_service
    enabled = bool(payload.get("enabled", False))
    current_settings = await get_settings()
    current_settings["auto_reply"] = enabled
    await update_settings(current_settings)

    # Sync experiment service state completely
    parveen_experiment_service.state["is_completed"] = False
    parveen_experiment_service.state["is_emergency_stopped"] = False
    parveen_experiment_service.state["is_enabled"] = enabled
    parveen_experiment_service._save_state()

    status_label = "ARMED // ACTIVE" if enabled else "AUTO-REPLY PAUSED"
    description = (
        "Automatic WhatsApp replies are active for explicitly authorized contacts."
        if enabled else
        "Your contact preferences are saved, but automatic WhatsApp replies are currently paused. Enable Global Auto-Reply when you are ready."
    )

    return {
        "success": True,
        "auto_reply_enabled": enabled,
        "status_label": status_label,
        "description": description,
        "status": parveen_experiment_service.get_status()
    }

@router.get("/activity")
async def get_activity():
    res = get_supabase().table("activity_logs").select("*").order("created_at", desc=True).limit(50).execute()
    return res.data or []
