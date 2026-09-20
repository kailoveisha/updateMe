-- =====================================================================
-- UPDATEME — create the two accounts (Kai and Isha)
--
-- Run this AFTER 20260920000000_updateme_setup.sql.
-- Supabase dashboard → SQL Editor → New query → paste → Run.
--
-- It creates two confirmed email/password users:
--     kai@updateme.local   /  Kai@12345
--     isha@updateme.local  /  Isha@12345
-- Passwords are stored hashed (bcrypt) by Supabase. They are NOT in the app code.
--
-- Safe to re-run: an account that already exists is skipped (not changed).
--
-- ⚠  These starting passwords are written in this file. If you push this file
--    to a PUBLIC GitHub repository, change the passwords afterwards in
--    Supabase → Authentication → Users → (⋯) → Send password recovery / edit,
--    or edit the values below before you run it.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  -- ✏️  Change the passwords here if you like.
  v_people jsonb := jsonb_build_array(
    jsonb_build_object('username', 'kai',  'password', 'Kai@12345'),
    jsonb_build_object('username', 'isha', 'password', 'Isha@12345')
  );
  v_domain   constant text := 'updateme.local';

  v_person   jsonb;
  v_username text;
  v_email    text;
  v_id       uuid;
  v_col      text;
begin
  for v_person in select * from jsonb_array_elements(v_people)
  loop
    v_username := v_person ->> 'username';
    v_email    := v_username || '@' || v_domain;

    if exists (select 1 from auth.users where email = v_email) then
      raise notice 'Skipping %: already exists', v_email;
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_person ->> 'password', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', v_username),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );

    -- Supabase Auth expects these token columns to be '' (not NULL).
    -- They differ slightly between Supabase versions, so only touch the ones that exist.
    for v_col in
      select column_name
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name in (
          'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'
        )
    loop
      execute format('update auth.users set %I = coalesce(%I, '''') where id = $1', v_col, v_col)
        using v_id;
    end loop;

    raise notice 'Created %', v_email;
  end loop;
end
$$;

-- The setup script's trigger gives each new user a profile automatically.
-- This makes sure, in case the accounts were created before the trigger existed:
insert into public.profiles (id, username, display_name)
select u.id,
       lower(split_part(u.email, '@', 1)),
       initcap(lower(split_part(u.email, '@', 1)))
from auth.users u
where lower(split_part(coalesce(u.email, ''), '@', 1)) in ('kai', 'isha')
on conflict do nothing;

-- Check: you should see two rows (kai, isha).
select username, display_name, created_at from public.profiles order by username;
