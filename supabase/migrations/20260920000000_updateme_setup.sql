-- =====================================================================
-- UPDATEME — complete Supabase setup
--
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. It is safe to run again; nothing is ever deleted.
--
-- What it creates:
--   • profiles       one row per person (Kai and Isha)
--   • messages       the conversation (text, emoji, image metadata)
--   • RLS policies   only the two profiles can read / write anything
--   • chat-images    a PRIVATE storage bucket + storage policies
--   • Realtime       live message inserts + presence authorisation
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{2,32}$')
);

comment on table public.profiles is
  'The people who belong to the Updateme conversation. Only usernames allowed in handle_new_user() get a row.';


-- ---------------------------------------------------------------------
-- 2. WHO IS ALLOWED IN
--    A signed-in user is a "participant" only if they have a profile.
--    Profiles are created automatically, but ONLY for the usernames
--    listed in handle_new_user() below. Even if someone manages to sign
--    up, they get no profile and RLS keeps them out of everything.
-- ---------------------------------------------------------------------
create or replace function public.is_participant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid()
  );
$$;

revoke all on function public.is_participant() from public, anon;
grant execute on function public.is_participant() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- "kai@updateme.local" → "kai"
  v_username text := lower(split_part(coalesce(new.email, ''), '@', 1));
begin
  -- The allow-list. To add a third person one day, add their username here.
  if v_username in ('kai', 'isha') then
    insert into public.profiles (id, username, display_name)
    values (new.id, v_username, initcap(v_username))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- If Kai / Isha already exist in Authentication → Users, give them profiles now.
insert into public.profiles (id, username, display_name)
select u.id,
       lower(split_part(u.email, '@', 1)),
       initcap(lower(split_part(u.email, '@', 1)))
from auth.users u
where lower(split_part(coalesce(u.email, ''), '@', 1)) in ('kai', 'isha')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 3. MESSAGES
--    The client generates the id (a UUID). That makes sending idempotent:
--    a retried send can never create a duplicate row.
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete restrict,
  body         text,
  image_path   text,
  image_width  integer,
  image_height integer,
  image_mime   text,
  image_size   integer,
  created_at   timestamptz not null default now(),

  constraint messages_has_content
    check (body is not null or image_path is not null),
  constraint messages_body_not_blank
    check (body is null or char_length(btrim(body)) > 0),
  constraint messages_body_length
    check (body is null or char_length(body) <= 4000),
  constraint messages_image_complete
    check (
      image_path is null
      or (
        char_length(image_path) <= 300
        and image_width  is not null and image_width  > 0
        and image_height is not null and image_height > 0
      )
    )
);

comment on table public.messages is
  'The Updateme conversation. Rows are never updated or deleted by the app.';

create index if not exists messages_created_at_idx
  on public.messages (created_at desc, id desc);


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- Start from nothing, then grant only what the app needs.
revoke all on public.profiles from anon, authenticated;
revoke all on public.messages from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.messages to authenticated;
-- created_at is deliberately NOT insertable: the server clock decides it.
grant insert (id, sender_id, body, image_path, image_width, image_height, image_mime, image_size)
  on public.messages to authenticated;

drop policy if exists "profiles: participants can read" on public.profiles;
create policy "profiles: participants can read"
  on public.profiles
  for select
  to authenticated
  using ((select public.is_participant()));

drop policy if exists "messages: participants can read" on public.messages;
create policy "messages: participants can read"
  on public.messages
  for select
  to authenticated
  using ((select public.is_participant()));

drop policy if exists "messages: participants can send as themselves" on public.messages;
create policy "messages: participants can send as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    (select public.is_participant())
    and sender_id = (select auth.uid())
    -- an image must live inside the sender's own storage folder
    and (image_path is null or image_path like (sender_id::text || '/%'))
  );

-- No UPDATE or DELETE policies exist on purpose: history is permanent.


-- ---------------------------------------------------------------------
-- 5. SMALL HELPER: numbers for the "details" panel (one round trip)
--    security invoker → RLS still applies to the caller.
-- ---------------------------------------------------------------------
create or replace function public.chat_stats()
returns table (total bigint, photos bigint, first_message_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint, count(m.image_path)::bigint, min(m.created_at)
  from public.messages m;
$$;

revoke all on function public.chat_stats() from public, anon;
grant execute on function public.chat_stats() to authenticated;


-- ---------------------------------------------------------------------
-- 6. REALTIME — broadcast new messages to subscribed clients
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

-- Presence ("here now") runs on a PRIVATE realtime channel, so only the
-- participants may join it.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "updateme: participants can receive presence" on realtime.messages';
    execute $p$
      create policy "updateme: participants can receive presence"
        on realtime.messages
        for select
        to authenticated
        using ((select public.is_participant()) and realtime.messages.extension = 'presence')
    $p$;

    execute 'drop policy if exists "updateme: participants can announce presence" on realtime.messages';
    execute $p$
      create policy "updateme: participants can announce presence"
        on realtime.messages
        for insert
        to authenticated
        with check ((select public.is_participant()) and realtime.messages.extension = 'presence')
    $p$;
  end if;
end
$$;


-- ---------------------------------------------------------------------
-- 7. STORAGE — private bucket for chat images
--    Files are stored as  <user id>/<message id>.<ext>
--    Nobody can read them without being signed in as a participant, and
--    people can only upload into their own folder. Images are shown in the
--    app through short-lived signed URLs.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat-images: participants can read" on storage.objects;
create policy "chat-images: participants can read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (select public.is_participant())
  );

drop policy if exists "chat-images: participants can upload to their own folder" on storage.objects;
create policy "chat-images: participants can upload to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (select public.is_participant())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- No UPDATE / DELETE storage policies: uploaded images are permanent too.

-- =====================================================================
-- Done. Next: create the two accounts (see supabase/create_users.sql or
-- the README), then run the app.
-- =====================================================================
