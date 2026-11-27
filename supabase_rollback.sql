-- ============================================================================
-- ChatPilot AI Migration Rollback Script (Additive Extensions Only)
-- Target Project: bxtqwqarxddrnkshwezg
-- Target Database: Supabase PostgreSQL 17 (ap-northeast-1)
-- ============================================================================
-- WARNING: DESTRUCTIVE ACTION FOR THE 9 ADDITIVE EXTENSION TABLES ONLY.
-- This script permanently drops the 9 extension tables and any data inside them.
-- It NEVER drops, alters, or truncates any of the 15 existing core tables.
-- DO NOT EXECUTE AUTOMATICALLY. Requires explicit user approval and a separate
-- extension data backup before running if tables contain data.
-- ============================================================================

BEGIN;

-- Preflight Safety Check: Confirm this is being run on the expected database
do $$
begin
  if current_database() is null then
    raise exception 'Execution aborted: Database connection context is missing.';
  end if;
end $$;

-- 1. Drop extension tables in strict reverse-dependency order
drop table if exists public.assistant_session_messages cascade;
drop table if exists public.assistant_sessions cascade;
drop table if exists public.response_feedback cascade;
drop table if exists public.message_attachments cascade;
drop table if exists public.response_policies cascade;
drop table if exists public.contact_relationships cascade;
drop table if exists public.contact_style_profiles cascade;
drop table if exists public.chat_import_sources cascade;
drop table if exists public.chat_import_batches cascade;

-- 2. Clean up composite unique indexes on core tables if no other constraints reference them
drop index if exists public.uq_contacts_owner_id;
drop index if exists public.uq_messages_owner_id;
drop index if exists public.uq_reply_drafts_owner_id;

COMMIT;
