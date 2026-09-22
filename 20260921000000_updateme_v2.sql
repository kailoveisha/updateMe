-- =====================================================================
-- UPDATEME v2 — voice messages + saved appearance
--
-- Run this ONCE in Supabase → SQL Editor, BEFORE deploying the new app
-- version. It only ADDS things (new columns, a new bucket, new policies).
-- Your existing messages and photos are not touched. Safe to re-run.
--
-- Adds:
--   • messages.audio_path / audio_duration_ms / audio_peaks   voice notes (max 30 s)
--   • profiles.preferences                                     each person's theme
--   • chat-voice                                               private bucket for voice notes
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. VOICE NOTES on messages
-- ---------------------------------------------------------------------
alter table public.messages
  add column if not exists audio_path        text,
  add column if not exists audio_duration_ms integer,
  add column if not exists audio_peaks       jsonb;

-- A message may now be text, an image, or a voice note.
alter table public.messages drop constraint if exists messages_has_content;
alter table public.messages
  add constraint messages_has_content
  check (body is not null or image_path is not null or audio_path is not null);

alter table public.messages drop constraint if exists messages_audio_complete;
alter table public.messages
  add constraint messages_audio_complete
  check (
    audio_path is null
    or (
      char_length(audio_path) <= 300
      and audio_duration_ms is not null
      and audio_duration_ms between 300 and 31000          -- 30 s limit (+1 s grace)
      and (
        audio_peaks is null
        or (jsonb_typeof(audio_peaks) = 'array' and jsonb_array_length(audio_peaks) <= 128)
      )
    )
  );

alter table public.messages drop constraint if exists messages_one_media;
alter table public.messages
  add constraint messages_one_media
  check (not (image_path is not null and audio_path is not null));

-- The new columns may be inserted by signed-in participants (created_at still may not).
grant insert (audio_path, audio_duration_ms, audio_peaks) on public.messages to authenticated;

-- Re-create the insert rule so voice files must also live in the sender's own folder.
drop policy if exists "messages: participants can send as themselves" on public.messages;
create policy "messages: participants can send as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    (select public.is_participant())
    and sender_id = (select auth.uid())
    and (image_path is null or image_path like (sender_id::text || '/%'))
    and (audio_path is null or audio_path like (sender_id::text || '/%'))
  );


-- ---------------------------------------------------------------------
-- 2. SAVED APPEARANCE (paper style + colour), per person
--    A person may update ONLY their own `preferences` column.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_preferences_small;
alter table public.profiles
  add constraint profiles_preferences_small
  check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) < 2000);

grant update (preferences) on public.profiles to authenticated;

drop policy if exists "profiles: people can update their own preferences" on public.profiles;
create policy "profiles: people can update their own preferences"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 3. STORAGE — private bucket for voice notes
--    Same rules as chat-images: participants only, own folder only,
--    no updates, no deletes. Voice notes are stored as small WAV files.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-voice',
  'chat-voice',
  false,
  4194304, -- 4 MB (a 30 s note is about 1.5 MB)
  array['audio/wav', 'audio/x-wav', 'audio/wave']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat-voice: participants can read" on storage.objects;
create policy "chat-voice: participants can read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-voice'
    and (select public.is_participant())
  );

drop policy if exists "chat-voice: participants can upload to their own folder" on storage.objects;
create policy "chat-voice: participants can upload to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-voice'
    and (select public.is_participant())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =====================================================================
-- Done. Now deploy the new app version.
-- =====================================================================
