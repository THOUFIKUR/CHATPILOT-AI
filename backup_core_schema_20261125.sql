-- ChatPilot AI Core Schema Definition (Pre-Migration Baseline)
-- Project: bxtqwqarxddrnkshwezg
-- Target: Supabase PostgreSQL 17 (ap-northeast-1)
-- Preserves all 15 core tables, relationships, and constraints.

-- 1. Contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone_e164 text,
  whatsapp_jid text,
  is_selected boolean not null default true,
  auto_reply_enabled boolean not null default false,
  reply_mode text not null default 'approval' check (reply_mode in ('approval', 'auto')),
  preferred_language text default 'Auto',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Chatpilot Groups
create table if not exists public.chatpilot_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  whatsapp_jid text not null,
  is_active boolean not null default true,
  rule_type text not null default 'mentions_only' check (rule_type in ('reply_to_all', 'mentions_only')),
  mention_triggers jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_type text not null check (conversation_type in ('contact', 'group')),
  contact_id uuid references public.contacts(id) on delete cascade,
  group_id uuid references public.chatpilot_groups(id) on delete cascade,
  title text,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  external_message_id text,
  direction text not null check (direction in ('incoming', 'outgoing')),
  sender_identifier text,
  sender_name text,
  body text,
  message_type text not null default 'text',
  source text not null default 'manual' check (source in ('manual', 'notification')),
  message_timestamp timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. AI Providers
create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null check (provider_name in ('groq', 'gemini', 'openrouter', 'ollama')),
  model_name text not null,
  priority integer not null default 1,
  is_enabled boolean not null default true,
  allow_private_content boolean not null default true,
  monthly_budget numeric(10,2) default 50.00,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. AI Usage Logs
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_name text,
  model_name text,
  request_status text default 'success',
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  estimated_cost numeric default 0,
  latency_ms integer default 0,
  error_code text,
  created_at timestamptz not null default now()
);

-- 7. Reply Drafts
create table if not exists public.reply_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  source_message_id uuid references public.messages(id) on delete set null,
  draft_text text not null,
  provider_name text,
  model_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent')),
  approved_at timestamptz,
  sent_at timestamptz,
  send_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Activity Logs
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  description text,
  related_conversation_id uuid references public.conversations(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 9. Integration Events
create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'notification',
  external_event_id text,
  event_type text not null,
  processing_status text not null default 'received',
  safe_metadata jsonb default '{}'::jsonb,
  received_at timestamptz default now(),
  processed_at timestamptz
);

-- 10. App Settings
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. Conversation Summaries
create table if not exists public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  summary text not null,
  covered_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. Contact Memory
create table if not exists public.contact_memory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  group_id uuid references public.chatpilot_groups(id) on delete cascade,
  memory_key text not null,
  memory_value text not null,
  confidence numeric(4,3) default 0.8,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 13. Contact Prompts
create table if not exists public.contact_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  group_id uuid references public.chatpilot_groups(id) on delete cascade,
  system_prompt text not null,
  tone text default 'casual',
  language_mode text default 'Tanglish',
  max_reply_chars integer default 150,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 14. Writing Samples
create table if not exists public.writing_samples (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  sample_text text not null,
  context_tags jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 15. Devices
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  device_type text not null default 'windows_desktop',
  is_paired boolean not null default true,
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now()
);
