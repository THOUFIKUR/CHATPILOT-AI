# System Architecture — ChatPilot AI

## Overview Diagram

```
+-------------------------------------------------------------+
|                     ChatPilot AI UI                         |
|             (React + TypeScript + Tailwind CSS)             |
|   - Overview Dashboard       - Groups Management            |
|   - Contacts Management      - AI Provider Control Center   |
|   - Conversation Memory      - Reply Inbox & Approval       |
|   - WhatsApp Chat Importer   - Windows Message Simulator    |
+------------------------------+------------------------------+
                               | REST / HTTP (JSON)
                               v
+-------------------------------------------------------------+
|                   FastAPI Backend Core                      |
|                  (Python 3.12 / Uvicorn)                    |
|   - routers/ (contacts, groups, ai, replies, memory, etc.)  |
|   - services/importer_service (WhatsApp .txt Parser)        |
|   - services/style_service (Tanglish/Tamil Style Learner)   |
|   - services/reply_service (Prompt Builder & Guardrail)     |
|   - services/ai_manager (Groq, Gemini, OpenRouter Router)   |
+---------------+-----------------------------+---------------+
                |                             |
                v                             v
+-------------------------------+ +---------------------------+
|    Supabase PostgreSQL        | |     AI Cloud Providers    |
|   (15 Production Tables)      | |  - Groq (Qwen / Llama)    |
|   - contacts, chatpilot_groups| |  - Gemini (Flash-Lite)    |
|   - conversations, messages   | |  - OpenRouter (DeepSeek)  |
|   - contact_memory, summaries | +---------------------------+
|   - writing_samples, drafts   |
|   - ai_providers, usage_logs  |
+-------------------------------+
```

## Security & Privacy Isolation
- Contacts have dedicated UUIDs.
- `contact_memory` and `writing_samples` are strictly partitioned by `contact_id`.
- High-risk keywords (OTP, Banking, Password) are blocked by the safety pre-filter before any external AI call.
