-- ChatPilot AI additive WhatsApp-learning extensions
-- Target project: bxtqwqarxddrnkshwezg
-- This file is a reviewed proposal. Do not execute until schema diff and backup review.

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

create table if not exists public.chat_import_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.chat_import_batches(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
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

create table if not exists public.contact_style_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
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

create table if not exists public.contact_relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
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

create table if not exists public.response_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
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

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text,
  original_filename text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  sha256 text,
  analysis_status text not null default 'pending' check (analysis_status in ('pending','processing','completed','failed','not_supported','needs_review')),
  analysis_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (storage_path is not null or original_filename is not null)
);

create table if not exists public.response_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reply_draft_id uuid references public.reply_drafts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  feedback_type text not null check (feedback_type in ('accepted','edited','rejected','regenerated','not_relevant')),
  original_draft text,
  final_text text,
  reason text,
  style_feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enforce that referenced rows belong to the same authenticated owner.
-- Composite unique indexes support the composite foreign keys below.
create unique index if not exists uq_contacts_owner_id_id on public.contacts(owner_id, id);
create unique index if not exists uq_messages_owner_id_id on public.messages(owner_id, id);
create unique index if not exists uq_reply_drafts_owner_id_id on public.reply_drafts(owner_id, id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chat_import_sources_owner_contact_fkey') then
    alter table public.chat_import_sources add constraint chat_import_sources_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete set null (contact_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_style_profiles_owner_contact_fkey') then
    alter table public.contact_style_profiles add constraint contact_style_profiles_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_relationships_owner_contact_fkey') then
    alter table public.contact_relationships add constraint contact_relationships_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'response_policies_owner_contact_fkey') then
    alter table public.response_policies add constraint response_policies_owner_contact_fkey
      foreign key (owner_id, contact_id) references public.contacts(owner_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'message_attachments_owner_message_fkey') then
    alter table public.message_attachments add constraint message_attachments_owner_message_fkey
      foreign key (owner_id, message_id) references public.messages(owner_id, id) on delete cascade;
  end if;
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
end $$;

create index if not exists idx_chat_import_batches_owner_created on public.chat_import_batches(owner_id, created_at desc);
create index if not exists idx_chat_import_sources_batch on public.chat_import_sources(batch_id);
create index if not exists idx_chat_import_sources_contact on public.chat_import_sources(contact_id);
create index if not exists idx_contact_style_profiles_contact on public.contact_style_profiles(owner_id, contact_id, review_status);
create index if not exists idx_contact_relationships_owner on public.contact_relationships(owner_id, contact_id);
create index if not exists idx_response_policies_lookup on public.response_policies(owner_id, scope, contact_id, message_category) where enabled;
create index if not exists idx_message_attachments_message on public.message_attachments(message_id);
create index if not exists idx_response_feedback_contact on public.response_feedback(owner_id, contact_id, created_at desc);

alter table public.chat_import_batches enable row level security;
alter table public.chat_import_sources enable row level security;
alter table public.contact_style_profiles enable row level security;
alter table public.contact_relationships enable row level security;
alter table public.response_policies enable row level security;
alter table public.message_attachments enable row level security;
alter table public.response_feedback enable row level security;

-- Owner-only policies. UPDATE policies include WITH CHECK to prevent owner reassignment.
do $$
declare t text;
begin
  foreach t in array array['chat_import_batches','chat_import_sources','contact_style_profiles','contact_relationships','response_policies','message_attachments','response_feedback'] loop
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

-- Do not add broad grants here. Confirm Data API exposure settings and the app's
-- intended access path before granting table privileges. Never expose service keys.
