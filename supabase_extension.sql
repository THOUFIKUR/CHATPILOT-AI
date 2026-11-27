-- ChatPilot AI Additive WhatsApp-Learning Extensions
-- Target Project: bxtqwqarxddrnkshwezg
-- Target Database: Supabase PostgreSQL 17 (ap-northeast-1)
-- Migration Version: 20261125220000_chatpilot_extension_schema
-- Status: Reviewed Proposal (Awaiting Gate A Approval)
-- Mode: 100% Additive (No drops, truncations, or modifications of existing core tables)

BEGIN;

-- 1. Import Batches
create table if not exists public.chat_import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'whatsapp_txt_zip' check (source_type in ('whatsapp_txt_zip','manual','other')),
  batch_name text,
  status text not null default 'pending' check (status in ('pending','validating','ready','importing','completed','partial','failed','cancelled')),
  total_sources integer not null default 0 check (total_sources >= 0),
  total_messages integer not null default 0 check (total_messages >= 0),
  imported_messages integer not null default 0 check (imported_messages >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists uq_chat_import_batches_owner_id
  on public.chat_import_batches(owner_id, id);

-- 2. Import Sources
create table if not exists public.chat_import_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  contact_id uuid,
  source_filename text not null,
  source_sha256 text not null,
  source_bytes bigint not null default 0 check (source_bytes >= 0),
  exported_chat_title text,
  parsed_message_count integer not null default 0 check (parsed_message_count >= 0),
  imported_message_count integer not null default 0 check (imported_message_count >= 0),
  date_range_start timestamptz,
  date_range_end timestamptz,
  possible_group_chat boolean not null default false,
  status text not null default 'pending' check (status in ('pending','validated','imported','duplicate','failed','needs_review')),
  parser_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(owner_id, source_sha256)
);

-- 3. Contact Style Profiles
create table if not exists public.contact_style_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  profile_version integer not null default 1 check (profile_version > 0),
  style_profile jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  review_status text not null default 'needs_review' check (review_status in ('needs_review','approved','rejected','stale')),
  last_analyzed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, contact_id, profile_version)
);

-- 4. Contact Relationships
create table if not exists public.contact_relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  relationship_type text not null default 'unknown' check (relationship_type in ('unknown','friend','classmate','senior','junior','faculty','family','club_member','colleague','professional','other')),
  context_label text,
  notes text,
  source text not null default 'user_confirmed' check (source in ('user_confirmed','conversation_inferred','manual')),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  needs_user_confirmation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, contact_id)
);

-- 5. Response Policies
create table if not exists public.response_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid,
  scope text not null default 'global' check (scope in ('global','contact')),
  message_category text not null,
  action text not null default 'require_approval' check (action in ('draft','hold','require_approval','never_send')),
  holding_template text,
  policy_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'global' and contact_id is null) or (scope = 'contact' and contact_id is not null))
);

-- 6. Message Attachments Catalog
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid,
  attachment_type text not null check (attachment_type in ('image','audio','video','document','other')),
  original_filename text,
  storage_path text,
  mime_type text,
  file_bytes bigint check (file_bytes is null or file_bytes >= 0),
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. Response Feedback Loop
create table if not exists public.response_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reply_draft_id uuid,
  contact_id uuid,
  source_message_id uuid,
  action_taken text not null check (action_taken in ('sent_as_is','edited_before_send','rejected','discarded')),
  original_draft text,
  final_sent_text text,
  edit_distance integer check (edit_distance is null or edit_distance >= 0),
  feedback_notes text,
  created_at timestamptz not null default now()
);

-- 8. Assistant Sessions (Private Executive Workspace)
create table if not exists public.assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists uq_assistant_sessions_owner_id
  on public.assistant_sessions(owner_id, id);

-- 9. Assistant Session Messages (Scoped to session and owner)
create table if not exists public.assistant_session_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  context_refs jsonb not null default '[]'::jsonb,
  sequence_number integer not null default 0,
  created_at timestamptz not null default now()
);

-- Composite Unique Indexes on Existing Core Tables for Tenant-Enclosed Foreign Keys
create unique index if not exists uq_contacts_owner_id on public.contacts(owner_id, id);
create unique index if not exists uq_messages_owner_id on public.messages(owner_id, id);
create unique index if not exists uq_reply_drafts_owner_id on public.reply_drafts(owner_id, id);

-- Composite Foreign Key Constraints (Enforcing Tenant Isolation and Rejecting Cross-Owner References)
do $$
begin
  -- chat_import_sources -> chat_import_batches (Composite FK)
  if not exists (select 1 from pg_constraint where conname = 'chat_import_sources_owner_batch_fkey') then
    alter table public.chat_import_sources add constraint chat_import_sources_owner_batch_fkey
      foreign key (owner_id, batch_id) references public.chat_import_batches(owner_id, id) on delete cascade;
  end if;

  -- chat_import_sources -> contacts (Composite FK, null contact_id on delete)
  if not exists (select 1 from pg_constraint where conname = 'chat_import_sources_owner_contact_fkey') then
    alter table public.chat_import_sources add constraint chat_import_sources_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete set null (contact_id);
  end if;

  -- contact_style_profiles -> contacts (Composite FK)
  if not exists (select 1 from pg_constraint where conname = 'contact_style_profiles_owner_contact_fkey') then
    alter table public.contact_style_profiles add constraint contact_style_profiles_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete cascade;
  end if;

  -- contact_relationships -> contacts (Composite FK)
  if not exists (select 1 from pg_constraint where conname = 'contact_relationships_owner_contact_fkey') then
    alter table public.contact_relationships add constraint contact_relationships_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete cascade;
  end if;

  -- response_policies -> contacts (Composite FK)
  if not exists (select 1 from pg_constraint where conname = 'response_policies_owner_contact_fkey') then
    alter table public.response_policies add constraint response_policies_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete cascade;
  end if;

  -- message_attachments -> messages (Composite FK)
  if not exists (select 1 from pg_constraint where conname = 'message_attachments_owner_message_fkey') then
    alter table public.message_attachments add constraint message_attachments_owner_message_fkey
      foreign key (owner_id, message_id) references public.messages(owner_id, id) on delete cascade;
  end if;

  -- response_feedback -> reply_drafts, contacts, messages (Composite FKs)
  if not exists (select 1 from pg_constraint where conname = 'response_feedback_owner_draft_fkey') then
    alter table public.response_feedback add constraint response_feedback_owner_draft_fkey
      foreign key (owner_id, reply_draft_id) references public.reply_drafts(owner_id, id) on delete set null (reply_draft_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'response_feedback_owner_contact_fkey') then
    alter table public.response_feedback add constraint response_feedback_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete set null (contact_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'response_feedback_owner_message_fkey') then
    alter table public.response_feedback add constraint response_feedback_owner_message_fkey
      foreign key (owner_id, source_message_id) references public.messages(owner_id, id) on delete set null (source_message_id);
  end if;

  -- assistant_session_messages -> assistant_sessions (Composite FK)
  if not exists (select 1 from pg_constraint where conname = 'assistant_session_messages_owner_session_fkey') then
    alter table public.assistant_session_messages add constraint assistant_session_messages_owner_session_fkey
      foreign key (owner_id, session_id) references public.assistant_sessions(owner_id, id) on delete cascade;
  end if;
end $$;

-- Query Performance & Tenant Lookup Indexes
create index if not exists idx_chat_import_batches_owner_created on public.chat_import_batches(owner_id, created_at desc);
create index if not exists idx_chat_import_sources_owner_batch on public.chat_import_sources(owner_id, batch_id);
create index if not exists idx_chat_import_sources_owner_contact on public.chat_import_sources(owner_id, contact_id);
create index if not exists idx_contact_style_profiles_contact on public.contact_style_profiles(owner_id, contact_id, review_status);
create index if not exists idx_contact_relationships_owner on public.contact_relationships(owner_id, contact_id);
create index if not exists idx_response_policies_lookup on public.response_policies(owner_id, scope, contact_id, message_category) where enabled;
create index if not exists idx_message_attachments_owner_msg on public.message_attachments(owner_id, message_id);
create index if not exists idx_response_feedback_contact on public.response_feedback(owner_id, contact_id, created_at desc);
create index if not exists idx_assistant_sessions_owner on public.assistant_sessions(owner_id, updated_at desc);
create index if not exists idx_assistant_messages_session on public.assistant_session_messages(owner_id, session_id, sequence_number);

-- Enable Row Level Security (RLS) on all 9 tables
alter table public.chat_import_batches enable row level security;
alter table public.chat_import_sources enable row level security;
alter table public.contact_style_profiles enable row level security;
alter table public.contact_relationships enable row level security;
alter table public.response_policies enable row level security;
alter table public.message_attachments enable row level security;
alter table public.response_feedback enable row level security;
alter table public.assistant_sessions enable row level security;
alter table public.assistant_session_messages enable row level security;

-- Owner-only RLS policies with WITH CHECK to prevent tenant reassignment
do $$
declare t text;
begin
  foreach t in array array[
    'chat_import_batches',
    'chat_import_sources',
    'contact_style_profiles',
    'contact_relationships',
    'response_policies',
    'message_attachments',
    'response_feedback',
    'assistant_sessions',
    'assistant_session_messages'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_owner_select', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t||'_owner_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_owner_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t||'_owner_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_owner_update', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t||'_owner_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_owner_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t||'_owner_delete', t);
  end loop;
end $$;

-- Explicit Table Privileges & Grants (Defense in Depth)
-- Revokes anonymous access and grants authenticated (RLS-governed) & service-role privileges
do $$
declare t text;
begin
  foreach t in array array[
    'chat_import_batches',
    'chat_import_sources',
    'contact_style_profiles',
    'contact_relationships',
    'response_policies',
    'message_attachments',
    'response_feedback',
    'assistant_sessions',
    'assistant_session_messages'
  ] loop
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

COMMIT;
