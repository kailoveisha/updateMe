-- =====================================================================
-- UPDATEME v5 — reply to a message
--
-- Run this ONCE in Supabase → SQL Editor. Run v2 and v3 first if you
-- haven't. Safe to re-run. Nothing existing is changed or deleted.
--
-- Adds:
--   • messages.reply_to_id     which earlier message (if any) this one
--                                is a reply to
-- =====================================================================

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

create index if not exists messages_reply_to_id_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;

-- Column grants are additive: this adds to what v1 already granted, it doesn't replace it.
grant insert (reply_to_id) on public.messages to authenticated;

-- The per-person view (v3) needs to include the new column.
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
  m.created_at,
  m.reply_to_id
from public.messages m
where not exists (
  select 1
  from public.message_hides h
  where h.message_id = m.id
    and h.user_id = (select auth.uid())
);

revoke all on public.messages_visible from anon, authenticated;
grant select on public.messages_visible to authenticated;

-- =====================================================================
-- Done. Now deploy the new app version.
-- =====================================================================
