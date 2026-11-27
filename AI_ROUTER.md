# AI Router & Fallback Architecture

ChatPilot AI uses a prioritized multi-provider fallback engine:

1. **Priority 1: Groq (`qwen/qwen3.8-27b`)**
   - Lightning-fast generation (sub-1500ms).
   - Natural support for Tamil, English, and Tanglish conversational tone.

2. **Priority 2: Google Gemini (`gemini-flash-lite-latest`)**
   - High speed and extensive context window.
   - Used when Groq is busy, rate-limited, or encountering network spikes.

3. **Priority 3: OpenRouter (`deepseek/deepseek-chat`)**
   - Deep reasoning fallback.
   - Redundant key failover support.

## Privacy Routing
Providers configured with `allow_private_content = false` are automatically bypassed for sensitive contacts.
All generation requests record latency, status, tokens, and estimated cost into `ai_usage_logs`.
