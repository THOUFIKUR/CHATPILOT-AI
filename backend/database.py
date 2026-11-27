from supabase import create_client, Client
from config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)

def get_supabase() -> Client:
    return supabase

def log_activity(event_type: str, description: str, conversation_id: str = None, metadata: dict = None):
    try:
        supabase.table("activity_logs").insert({
            "owner_id": settings.DEFAULT_OWNER_ID,
            "event_type": event_type,
            "description": description,
            "related_conversation_id": conversation_id,
            "metadata": metadata or {}
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")

def initialize_default_data():
    """Ensure initial providers and settings exist in the database."""
    try:
        existing_providers = supabase.table("ai_providers").select("*").execute()
        if not existing_providers.data:
            initial_providers = [
                {
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "provider_name": "groq",
                    "model_name": "qwen/qwen3.8-27b",
                    "priority": 1,
                    "is_enabled": True,
                    "allow_private_content": True,
                    "monthly_budget": 50.0,
                    "settings": {"temperature": 0.7, "max_tokens": 150, "top_p": 1.0}
                },
                {
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "provider_name": "gemini",
                    "model_name": "gemini-flash-lite-latest",
                    "priority": 2,
                    "is_enabled": True,
                    "allow_private_content": True,
                    "monthly_budget": 50.0,
                    "settings": {"temperature": 0.7, "max_tokens": 150, "top_p": 1.0}
                },
                {
                    "owner_id": settings.DEFAULT_OWNER_ID,
                    "provider_name": "openrouter",
                    "model_name": "deepseek/deepseek-chat",
                    "priority": 3,
                    "is_enabled": True,
                    "allow_private_content": True,
                    "monthly_budget": 100.0,
                    "settings": {"temperature": 0.7, "max_tokens": 150, "top_p": 1.0}
                }
            ]
            supabase.table("ai_providers").insert(initial_providers).execute()
            logger.info("Initialized default AI providers.")

        existing_settings = supabase.table("app_settings").select("*").execute()
        if not existing_settings.data:
            supabase.table("app_settings").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "settings": {
                    "auto_reply": True,
                    "reply_delay_min": 2,
                    "reply_delay_max": 5,
                    "default_language": "Auto",
                    "theme": "Light",
                    "user_name": "Thoufikur Rahman",
                    "notification_enabled": True
                }
            }).execute()
            logger.info("Initialized default app settings.")
    except Exception as e:
        logger.warning(f"Default initialization note: {e}")
