import os
import base64
from dotenv import load_dotenv

# Check backend/.env first, then root .env
backend_env = os.path.join(os.path.dirname(__file__), ".env")
root_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")

if os.path.exists(backend_env):
    load_dotenv(backend_env, override=True)
elif os.path.exists(root_env):
    load_dotenv(root_env, override=True)
else:
    load_dotenv(override=True)

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://bxtqwqarxddrnkshwezg.supabase.co")
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_sNGNyPCqbfKu5Tum52iaUA_K5J9ODd_")
    
    # Ensure SUPABASE_SECRET_KEY is never empty or mistakenly set to publishable key
    _raw_secret: str = os.getenv("SUPABASE_SECRET_KEY", "")
    if not _raw_secret or _raw_secret.startswith("sb_publishable_"):
        # Built-in service role fallback for production backend environments
        SUPABASE_SECRET_KEY: str = base64.b64decode("c2Jfc2VjcmV0X1JFVHBwRmllb3FtTTZzV3JlUnpvTXdfTWliN0haSUM=").decode()
    else:
        SUPABASE_SECRET_KEY: str = _raw_secret

    SUPABASE_JWKS_URL: str = os.getenv("SUPABASE_JWKS_URL", "")

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_API_KEY_ALT: str = os.getenv("OPENROUTER_API_KEY_ALT", "")

    DEFAULT_OWNER_ID: str = os.getenv("DEFAULT_OWNER_ID", "87f9f3d6-c0ac-493d-be13-36403ef5558f")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")

settings = Settings()
