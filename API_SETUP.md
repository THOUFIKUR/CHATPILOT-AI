# API Setup & Configuration

## Environment Variables (`backend/.env`)

```env
SUPABASE_URL=https://bxtqwqarxddrnkshwezg.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_SECRET_KEY=your_supabase_secret_key_here
SUPABASE_JWKS_URL=https://bxtqwqarxddrnkshwezg.supabase.co/auth/v1/.well-known/jwks.json

GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_API_KEY_ALT=your_openrouter_api_key_alt_here

DEFAULT_OWNER_ID=87f9f3d6-c0ac-493d-be13-36403ef5558f
PORT=8000
HOST=127.0.0.1
```

## AI Provider Status
- **Groq**: Active (`qwen/qwen3.8-27b`) — Ultra low latency (~1100ms)
- **Gemini**: Active (`gemini-flash-lite-latest`) — (~800ms)
- **OpenRouter**: Active (`deepseek/deepseek-chat`) — High fidelity fallback
