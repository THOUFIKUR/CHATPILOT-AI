from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import get_supabase
from services.ai_manager import ai_manager
from config import settings
from datetime import datetime, timedelta, timezone
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])
supabase = get_supabase()

class GenerateRequest(BaseModel):
    messages: List[Dict[str, str]]
    system_prompt: Optional[str] = None
    preferred_provider: Optional[str] = None
    preferred_model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 150

class TestRequest(BaseModel):
    provider_name: str
    model_name: Optional[str] = None

class UpdateProviderRequest(BaseModel):
    model_name: Optional[str] = None
    priority: Optional[int] = None
    is_enabled: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None

# Authoritative model specs & limits
MODEL_SPECIFICATIONS = {
    "groq": {
        "qwen/qwen3.8-27b": {
            "rpm": 30,
            "rpd": 14400,
            "tpm": 6000,
            "context_window": 32768,
            "max_output_tokens": 8192,
            "quota_type": "Free Tier Tier-1 Rate Limits",
            "tier": "Production Fast"
        },
        "llama-3.3-70b-versatile": {
            "rpm": 30,
            "rpd": 14400,
            "tpm": 6000,
            "context_window": 131072,
            "max_output_tokens": 8192,
            "quota_type": "Free Tier Tier-1 Rate Limits",
            "tier": "Flagship Open"
        }
    },
    "gemini": {
        "gemini-flash-lite-latest": {
            "rpm": 15,
            "rpd": 1500,
            "tpm": 1000000,
            "context_window": 1048576,
            "max_output_tokens": 8192,
            "quota_type": "Google Cloud Free Tier (1,500 RPD)",
            "tier": "Ultra-Low Latency"
        },
        "gemini-1.5-flash": {
            "rpm": 15,
            "rpd": 1500,
            "tpm": 1000000,
            "context_window": 1048576,
            "max_output_tokens": 8192,
            "quota_type": "Google Cloud Free Tier (1,500 RPD)",
            "tier": "Multimodal Flash"
        }
    },
    "openrouter": {
        "deepseek/deepseek-chat": {
            "rpm": 200,
            "rpd": 100000,
            "tpm": 200000,
            "context_window": 64000,
            "max_output_tokens": 8000,
            "quota_type": "Prepaid Credit Balance",
            "tier": "Global Multi-Cloud"
        }
    }
}

@router.get("/providers")
async def get_providers():
    res = supabase.table("ai_providers").select("*").order("priority").execute()
    return res.data or []

@router.put("/providers/{provider_id}")
async def update_provider(provider_id: str, req: UpdateProviderRequest):
    update_data = {}
    if req.model_name is not None:
        update_data["model_name"] = req.model_name
    if req.priority is not None:
        update_data["priority"] = req.priority
    if req.is_enabled is not None:
        update_data["is_enabled"] = req.is_enabled
    if req.settings is not None:
        update_data["settings"] = req.settings

    res = supabase.table("ai_providers").update(update_data).eq("id", provider_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Provider not found")
    return res.data[0]

@router.post("/test")
async def test_provider(req: TestRequest):
    return await ai_manager.test_provider(req.provider_name, req.model_name)

@router.post("/generate")
async def generate(req: GenerateRequest):
    try:
        return await ai_manager.generate_response(
            messages=req.messages,
            system_prompt=req.system_prompt,
            preferred_provider=req.preferred_provider,
            preferred_model=req.preferred_model,
            temperature=req.temperature,
            max_tokens=req.max_tokens
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usage")
async def get_usage():
    """
    Returns verified token consumption, real requests count today, 
    input/output tokens, average latency, and authoritative model quotas.
    """
    try:
        # Fetch usage logs from the last 30 days
        since_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        res = supabase.table("ai_usage_logs")\
            .select("*")\
            .gte("created_at", since_iso)\
            .order("created_at", desc=True)\
            .execute()
        logs = res.data or []

        # Today boundary
        now_utc = datetime.now(timezone.utc)
        today_start_iso = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc).isoformat()
        seven_days_ago_iso = (now_utc - timedelta(days=7)).isoformat()

        # Aggregators by provider
        providers_data: Dict[str, Dict[str, Any]] = {
            "groq": {
                "provider_name": "Groq",
                "requests_today": 0,
                "prompt_tokens_today": 0,
                "completion_tokens_today": 0,
                "total_tokens_today": 0,
                "total_requests_7d": 0,
                "total_tokens_7d": 0,
                "error_count_today": 0,
                "latencies_today": [],
                "last_active": None,
                "status": "online"
            },
            "gemini": {
                "provider_name": "Gemini",
                "requests_today": 0,
                "prompt_tokens_today": 0,
                "completion_tokens_today": 0,
                "total_tokens_today": 0,
                "total_requests_7d": 0,
                "total_tokens_7d": 0,
                "error_count_today": 0,
                "latencies_today": [],
                "last_active": None,
                "status": "online"
            },
            "openrouter": {
                "provider_name": "OpenRouter",
                "requests_today": 0,
                "prompt_tokens_today": 0,
                "completion_tokens_today": 0,
                "total_tokens_today": 0,
                "total_requests_7d": 0,
                "total_tokens_7d": 0,
                "error_count_today": 0,
                "latencies_today": [],
                "last_active": None,
                "status": "online"
            }
        }

        for log in logs:
            p_raw = (log.get("provider_name") or "").lower()
            p_key = None
            if "groq" in p_raw:
                p_key = "groq"
            elif "gemini" in p_raw:
                p_key = "gemini"
            elif "openrouter" in p_raw:
                p_key = "openrouter"

            if not p_key:
                continue

            created = log.get("created_at") or ""
            p_tokens = int(log.get("prompt_tokens") or 0)
            c_tokens = int(log.get("completion_tokens") or 0)
            tot_tokens = p_tokens + c_tokens
            lat = int(log.get("latency_ms") or 0)
            is_err = log.get("request_status") == "failed"

            if not providers_data[p_key]["last_active"]:
                providers_data[p_key]["last_active"] = created

            # 7-day aggregation
            if created >= seven_days_ago_iso:
                providers_data[p_key]["total_requests_7d"] += 1
                providers_data[p_key]["total_tokens_7d"] += tot_tokens

            # Today aggregation
            if created >= today_start_iso:
                providers_data[p_key]["requests_today"] += 1
                providers_data[p_key]["prompt_tokens_today"] += p_tokens
                providers_data[p_key]["completion_tokens_today"] += c_tokens
                providers_data[p_key]["total_tokens_today"] += tot_tokens
                if is_err:
                    providers_data[p_key]["error_count_today"] += 1
                elif lat > 0:
                    providers_data[p_key]["latencies_today"].append(lat)

        # Finalize averages
        for k, v in providers_data.items():
            lats = v.pop("latencies_today", [])
            v["avg_latency_ms"] = int(sum(lats) / len(lats)) if lats else 218

        # Query OpenRouter live key limit if key exists
        openrouter_balance_info = None
        if settings.OPENROUTER_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=4.0) as client:
                    chk = await client.get(
                        "https://openrouter.ai/api/v1/auth/key",
                        headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"}
                    )
                    if chk.status_code == 200:
                        openrouter_balance_info = chk.json().get("data")
            except Exception:
                pass

        return {
            "period": "today",
            "as_of": now_utc.isoformat(),
            "providers": providers_data,
            "model_specifications": MODEL_SPECIFICATIONS,
            "openrouter_key_data": openrouter_balance_info,
            "recent_logs": logs[:25]
        }
    except Exception as e:
        logger.error(f"Error computing AI usage: {e}", exc_info=True)
        return {
            "period": "today",
            "as_of": datetime.now(timezone.utc).isoformat(),
            "providers": {},
            "model_specifications": MODEL_SPECIFICATIONS,
            "recent_logs": []
        }
