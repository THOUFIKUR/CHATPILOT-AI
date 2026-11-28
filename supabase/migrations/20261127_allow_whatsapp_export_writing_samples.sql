-- Additive migration: Allow 'whatsapp_export' in public.writing_samples.source
-- Preserves existing permitted values (e.g., 'manual') and existing rows without weakening RLS.

BEGIN;

ALTER TABLE public.writing_samples
  DROP CONSTRAINT IF EXISTS writing_samples_source_check;

ALTER TABLE public.writing_samples
  ADD CONSTRAINT writing_samples_source_check
  CHECK (source IN ('manual', 'whatsapp_export', 'imported', 'whatsapp', 'chat_export'));

COMMIT;
