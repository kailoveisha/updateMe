-- =====================================================================
-- UPDATEME v3 — unsend messages (for everyone, or just for you)
--
-- Run this ONCE in Supabase → SQL Editor, BEFORE deploying the new app
-- version. Run the v2 SQL first if you haven't. Safe to re-run.
--
-- Your existing messages, photos and voice notes are NOT changed.
--
-- Adds:
--   • messages.deleted_at         "unsent for everyone" marker (the row stays as a
--                                  small "unsent" note; its text/files are erased)
--   • message_hides               "delete for me": one row per (person, message)
--   • messages_visible (view)     the messages a person hasn't hidden — the app reads this
--   • unsend_message(id)          the ONLY way to unsend, and only your own messages
--   • storage delete rules        so an unsent message's photo/voice file can be removed
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. "Unsent for everyone" marker on messages
-- ---------------------------------------------------------------------
alter table public.messages
  add column if not exists deleted_at timestamptz;

-- A message is either real content, or an unsent (empty) marker.
alter table public.messages drop constraint if exists messages_has_content;
alter table public.messages
  add constraint messages_has_content
  check (deleted_at is not null or body is not null or image_path is not null or audio_path is not null);

alter table public.messages drop constraint if exists messages_deleted_is_empty;
alter table public.messages
  add constraint messages_deleted_is_empty
  check (deleted_at is null or (body is null and image_path is null and audio_path is null));

-- Lets the app catch up on unsends it missed while offline.
create index if not exists messages_deleted_at_idx
  on public.messages (deleted_at)
  where deleted_at is not null;

-- People still cannot set deleted_at (or edit anything) themselves: there is no UPDATE grant.
-- Unsending goes through unsend_message() below.


-- ---------------------------------------------------------------------
-- 2. "Delete for me" — a private list of messages each person has hidden
-- ---------------------------------------------------------------------
create table if not exists public.message_hides (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.message_hides enable row level security;
revoke all on public.message_hides from anon, authenticated;
grant select on public.message_hides to authenticated;
grant insert (user_id, message_id) on public.message_hides to authenticated;

drop policy if exists "hides: people see their own" on public.message_hides;
create policy "hides: people see their own"
  on public.message_hides
  for select
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_participant()));

drop policy if exists "hides: people hide messages for themselves" on public.message_hides;
create policy "hides: people hide messages for themselves"
  on public.message_hides
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_participant())
    and exists (select 1 from public.messages m where m.id = message_id)
  );


-- ---------------------------------------------------------------------
-- 3. The messages a person can see = everything they haven't hidden.
--    security_invoker: the caller's own access rules still apply.
-- ---------------------------------------------------------------------
create or replace view public.messages_visible
with (security_invoker = true)
as
select
  m.id,
  m.sender_id,
  m.body,
  m.image_path,
  m.image_width,
  m.image_height,
  m.image_mime,
  m.image_size,
  m.audio_path,
  m.audio_duration_ms,
  m.audio_peaks,
  m.deleted_at,
  m.created_at
from public.messages m
where not exists (
  select 1
  from public.message_hides h
  where h.message_id = m.id
    and h.user_id = (select auth.uid())
);

revoke all on public.messages_visible from anon, authenticated;
grant select on public.messages_visible to authenticated;


-- ---------------------------------------------------------------------
-- 4. UNSEND FOR EVERYONE
--    Only the sender, only their own message. The text and file references
--    are erased; the row stays so both screens can show "unsent a message".
--    Returns the file paths so the app can delete the actual files.
-- ---------------------------------------------------------------------
create or replace function public.unsend_message(p_id uuid)
returns table (removed_image text, removed_audio text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.messages%rowtype;
begin
  if not public.is_participant() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_row
  from public.messages
  where id = p_id and sender_id = auth.uid()
  for update;

  if not found then
    raise exception 'You can only unsend your own messages' using errcode = 'P0002';
  end if;

  -- Already unsent: nothing more to do (makes retries safe).
  if v_row.deleted_at is not null then
    return;
  end if;

  update public.messages
  set body              = null,
      image_path        = null,
      image_width       = null,
      image_height      = null,
      image_mime        = null,
      image_size        = null,
      audio_path        = null,
      audio_duration_ms = null,
      audio_peaks       = null,
      deleted_at        = now()
  where id = p_id;

  return query select v_row.image_path, v_row.audio_path;
end;
$$;

revoke all on function public.unsend_message(uuid) from public, anon;
grant execute on function public.unsend_message(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5. The numbers in the side panel skip unsent and hidden messages
-- ---------------------------------------------------------------------
create or replace function public.chat_stats()
returns table (total bigint, photos bigint, first_message_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint, count(m.image_path)::bigint, min(m.created_at)
  from public.messages m
  where m.deleted_at is null
    and not exists (
      select 1 from public.message_hides h
      where h.message_id = m.id and h.user_id = (select auth.uid())
    );
$$;

revoke all on function public.chat_stats() from public, anon;
grant execute on function public.chat_stats() to authenticated;


-- ---------------------------------------------------------------------
-- 6. REALTIME — both screens learn about unsends instantly, and a
--    person's other tabs learn about their "delete for me".
--    (Updates to `messages` are already published with the table.)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_hides'
  ) then
    alter publication supabase_realtime add table public.message_hides;
  end if;
end
$$;


-- ---------------------------------------------------------------------
-- 7. STORAGE — a photo / voice file may be removed by its owner, but ONLY
--    once no message refers to it any more (i.e. after unsending).
--    While a message still uses a file, it can't be deleted.
-- ---------------------------------------------------------------------
drop policy if exists "chat-images: owners can remove files no message uses" on storage.objects;
create policy "chat-images: owners can remove files no message uses"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (select public.is_participant())
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.messages m where m.image_path = storage.objects.name)
  );

drop policy if exists "chat-voice: owners can remove files no message uses" on storage.objects;
create policy "chat-voice: owners can remove files no message uses"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-voice'
    and (select public.is_participant())
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.messages m where m.audio_path = storage.objects.name)
  );

-- =====================================================================
-- Done. Now deploy the new app version.
-- =====================================================================
