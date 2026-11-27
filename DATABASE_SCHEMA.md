# Database Schema — ChatPilot AI

The Supabase project contains 15 verified tables:

1. **`contacts`**: Stores contact profiles, selection state, automation mode (`approval`/`auto`), preferred language, and WhatsApp JID.
2. **`chatpilot_groups`**: WhatsApp group management with rules (`reply_to_all`, `mentions_only`), mention triggers, and active toggles.
3. **`conversations`**: Tracks conversations by type (`contact` or `group`), linked to individual contact or group IDs.
4. **`messages`**: Inbound and outbound message logs with timestamp, sender, body, source (`notification`, `manual`), and direction (`incoming`, `outgoing`).
5. **`contact_prompts`**: Custom persona prompts, tone, and character limits per contact or group.
6. **`writing_samples`**: Real outgoing messages sent by the user, used for few-shot prompt injection.
7. **`contact_memory`**: Key-value memory facts extracted from conversations.
8. **`conversation_summaries`**: Context summaries of previous discussions.
9. **`ai_providers`**: Configured AI providers (`groq`, `gemini`, `openrouter`), model names, priorities, and budgets.
10. **`ai_usage_logs`**: Latency in ms, tokens consumed, cost estimates, and status codes per generation.
11. **`reply_drafts`**: AI-generated reply drafts awaiting approval (`pending`, `approved`, `rejected`).
12. **`devices`**: Paired devices (Windows Desktop, Android Companion).
13. **`integration_events`**: Raw incoming webhook events and status logs.
14. **`activity_logs`**: User-facing event history and audit trail.
15. **`app_settings`**: Global configuration (auto-reply, delay range, language, theme).
