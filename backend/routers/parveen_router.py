from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
from services.parveen_experiment_service import parveen_experiment_service

router = APIRouter(prefix="/api/experiment/parveen", tags=["parveen_experiment"])

class SimulateNotificationRequest(BaseModel):
    notification_id: Optional[str] = None
    source_app: str = "WhatsApp"
    sender: str = "Parveen"
    sender_phone: Optional[str] = "+919790171303"
    message: str
    is_outgoing: bool = False
    title: Optional[str] = None
    has_native_reply_action: bool = False
    simulate_sending: bool = True

@router.get("/status")
def get_parveen_experiment_status():
    """Returns the current lifecycle and one-shot state of the Parveen experiment."""
    return parveen_experiment_service.get_status()

@router.post("/start")
def start_parveen_experiment():
    """Starts or resumes the Parveen experiment."""
    return parveen_experiment_service.start_experiment()

@router.post("/stop")
def stop_parveen_experiment():
    """Pauses the Parveen experiment."""
    return parveen_experiment_service.stop_experiment()

@router.post("/mode")
def set_parveen_mode(mode: str = "automatic"):
    """Sets reply mode: 'automatic' (auto-submit), 'manual' (pre-fill chat only), or 'off'."""
    return parveen_experiment_service.set_reply_mode(mode)

@router.post("/emergency-stop")
def emergency_stop_parveen_experiment():
    """Global emergency stop: immediately halts all processing and disables experiment."""
    return parveen_experiment_service.emergency_stop()

@router.post("/reset")
def reset_parveen_experiment():
    """Resets the experiment state to allow another one-shot test."""
    return parveen_experiment_service.reset_experiment()

@router.post("/simulate-notification")
async def simulate_parveen_notification(req: SimulateNotificationRequest):
    """
    Simulates or receives an incoming notification event for the Parveen experiment.
    Runs full validation, safety checks, style personalization, and one-shot enforcement.
    """
    event = req.dict()
    result = await parveen_experiment_service.process_notification_event(event)
    return result

@router.get("/diagnostics")
def get_parveen_diagnostics():
    """Retrieves the recent diagnostic logs and audit trail for the experiment."""
    return {
        "status": parveen_experiment_service.get_status(),
        "diagnostics": parveen_experiment_service.state.get("diagnostic_logs", [])
    }
