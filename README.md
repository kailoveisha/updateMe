# Updateme

A small private chat for two people (Kai and Isha). Real-time messages, emoji and photos, a permanent history, and a login screen — nothing else.

Built with **Next.js**, **TypeScript**, **Tailwind CSS** and **Supabase** (Auth, Postgres, Realtime, Storage). It deploys to **Vercel**.

---

## What you need

- **Node.js 20.9 or newer** (`node -v` to check) — https://nodejs.org
- A free **Supabase** account — https://supabase.com
- (For going live) a free **Vercel** account and a **GitHub** account

---

## Setup in 5 steps

### 1. Create a Supabase project

Supabase dashboard → **New project**. Pick any name and region, and save the database password somewhere. Wait until the project finishes starting.

### 2. Run the database SQL

Dashboard → **SQL Editor** → **New query**.
Open `supabase/migrations/20260920000000_updateme_setup.sql`, paste **all** of it, click **Run**.

This creates the tables, the security rules (RLS), a private image bucket, and switches on realtime. It is safe to run more than once, and it never deletes anything.

### 3. Create the two accounts

Still in the SQL Editor: new query → paste `supabase/create_users.sql` → **Run**.
You should see two rows at the bottom: `kai` and `isha`.

| Name | Sign-in email (automatic) | Password |
|------|---------------------------|----------|
| Kai  | `kai@updateme.local`      | `Kai@12345` |
| Isha | `isha@updateme.local`     | `Isha@12345` |

On the login page, people just type **kai** or **isha** — the app adds `@updateme.local` for them.

> **Change the passwords** if this project is public or shared. Edit them at the top of `create_users.sql` *before* running it, or afterwards run:
> ```sql
> update auth.users
> set encrypted_password = extensions.crypt('YourNewPassword', extensions.gen_salt('bf')), updated_at = now()
> where email = 'kai@updateme.local';
> ```
> The passwords are **not** in the app code. They only exist in that SQL file (and, hashed, in Supabase). If you push the repo to a public GitHub repository, remove them from the file first.

**Also do this (30 seconds):** Dashboard → **Authentication** → **Sign In / Providers** → turn **off** “Allow new users to sign up”. Nobody else can then even create an account. (Even if it were on, strangers get no profile and the security rules keep them out of everything.)

<details>
<summary>Alternative: create the accounts from the dashboard instead</summary>

Authentication → Users → **Add user → Create new user**. Enter the email and password, and tick **Auto Confirm User**. Do it once for each account, using emails whose part before the `@` is exactly `kai` and `isha`. If the dashboard refuses `.local` addresses, use any other domain you like and set `NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN` to that domain (see below). The database creates each profile automatically.
</details>

### 4. Add your keys

Dashboard → **Project Settings → API** (or the **Connect** button). Copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

In the project folder:

```bash
cp .env.example .env.local
```

Open `.env.local` and paste the two values. Use only the **anon/publishable** key. The **service_role / secret** key is never needed and must never go in this app.

### 5. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in as `kai`, and open a second browser (or a private window) signed in as `isha` to watch messages arrive live.

---

## Environment variables

| Variable | Required | What it is |
|----------|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | The public anon/publishable key |
| `NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN` | no | Only if your accounts use a domain other than `updateme.local` |

---

## Deploy to Vercel

1. Push this folder to a GitHub repository (`.env.local` is git-ignored, so your keys stay private).
2. Vercel → **Add New… → Project** → import the repository. Framework: **Next.js** (detected automatically).
3. Under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy.**

Nothing else needs configuring in Supabase: sign-in is by password, so there are no redirect URLs to register.

---

## How it works

- **Only two people.** Profiles are created only for the usernames listed in `handle_new_user()` in the SQL. Every table and storage policy requires a profile, so everyone else is locked out at the database level, not just hidden in the interface.
- **Messages are permanent.** There are no update or delete policies. Signing out only ends your browser session.
- **Sending is instant and safe to retry.** The browser generates each message's ID, shows it immediately, and reconciles it with the database copy. A retry can never create a duplicate.
- **Live updates.** New messages arrive through Supabase Realtime. If the connection drops (or the tab sleeps), the app reconnects and fetches anything it missed, in order.
- **Images.** Big photos are shrunk in the browser (GIFs are left alone), uploaded to a **private** bucket with a real progress bar, and displayed through short-lived signed links.
- **“Here now”** is real Supabase Presence on a private channel. It shows nothing until the connection is actually up, so it never claims someone is away when it doesn't know.
- **History** loads the newest 40 messages and fetches older ones as you scroll up.

---

## Troubleshooting

**“That name and password don't match.”** Run `supabase/create_users.sql` (step 3), and check the password. Names aren't case-sensitive.

**“The database isn't set up yet.”** Run the setup SQL (step 2), then reload.

**“Live updates paused” never goes away.** Messages still send, but realtime isn't connecting. Re-run the setup SQL (it adds `messages` to the realtime publication), and check Dashboard → Database → Publications → `supabase_realtime`.

**No “Here now” indicator.** The presence policies are part of the setup SQL. Re-run it. Everything else works without presence.

**“This page is for two people.”** You signed in with an account that has no profile — use `kai` or `isha`.

**Can't delete a user in the dashboard.** Deliberate: the database refuses to delete someone who has written messages, so history can't disappear by accident. To reset a test setup, first run `truncate public.messages;`.

**Images won't load / upload.** Check that the `chat-images` bucket exists (Storage) and that the setup SQL ran without errors.

---

## Project layout

```
app/                 pages: /login, /chat, error + not-found screens, global styles
components/auth/     login screen and form
components/chat/     header, message list, message notes, composer, emoji picker, lightbox, side panel
components/ui/       small pieces: tape, date stamp, monogram, crop marks
hooks/               use-chat (state, realtime, sending), use-presence, use-signed-url, use-attachment
lib/chat/            queries, image processing + upload, error messages, formatting
lib/supabase/        browser / server / proxy clients
proxy.ts             keeps sessions fresh; sends signed-out visitors to /login
supabase/            setup SQL + account-creation SQL
```

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`.
