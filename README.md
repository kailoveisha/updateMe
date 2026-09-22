# Updateme

A small private chat for two people (Kai and Isha). Real-time messages, emoji, photos, GIFs and 30-second voice notes, live "writing…" indicators, search, a permanent history, and a settings screen (paper style, colours, change password).

Built with **Next.js**, **TypeScript**, **Tailwind CSS** and **Supabase** (Auth, Postgres, Realtime, Storage). It deploys to **Vercel**.

---

## Upgrading to v3 (unsend messages, Night theme, theme-matched bubbles)

Your conversation is safe: v3 only **adds** things. Nothing is modified or deleted.

1. **Run the SQL first.** Supabase → SQL Editor → New query → paste all of `supabase/migrations/20260922000000_updateme_v3.sql` → Run. *(If you never ran the v2 SQL, run `20260921000000_updateme_v2.sql` first.)*
2. **Then deploy the new code** (overwrite the files in your GitHub repo; Vercel redeploys). No new environment variables.

> If the new code goes live before the SQL, the chat shows "Couldn't open the chat" until you run it. Nothing is lost.

**What's new in v3**

- **Unsend.** Tap the **⋯** beside any message (it appears on hover on a computer, and is always faintly visible on a phone).
  - **Delete for me** — removes it from your screen only. The other person still sees it. Works on any message.
  - **Unsend for everyone** — only on your own messages. The text, photo or voice note is erased from the database and storage, and both screens show a small *"You unsent a message"* note. It happens live on both screens.
- **Night** — a dark theme, chosen in Settings → Ink. It works with all three papers, and the login page follows it too.
- **Bubbles follow the theme.** *Lines* = notebook slips with a coloured margin rule. *Dots* = rounded stickers with a hard shadow, a round mic and a rounded text box. *Grid* = framed blueprint labels. Colours follow the ink you picked.

---

## Upgrading from v1 to v2 (voice notes, themes, search, settings)

Your conversation is safe: the update only **adds** columns, a storage bucket and policies. No message or photo is modified or deleted.

**Do these in this order:**

1. **Run the new SQL first.** Supabase → SQL Editor → New query → paste all of `supabase/migrations/20260921000000_updateme_v2.sql` → Run. (It's safe to run twice.)
2. **Then deploy the new code.** Replace the files in your GitHub repository with the ones from this version (keep your repo, just overwrite the files), and Vercel redeploys automatically. No new environment variables are needed.

> If the new code goes live *before* the SQL has been run, the chat page will show "Couldn't open the chat" until you run it. Nothing is lost; run the SQL and reload.

**What's new**

- **Voice notes** — tap the mic (it replaces Send while the box is empty). Up to 30 seconds, with a review step before sending. Recorded as small WAV files so they play on every phone and browser.
- **Live "writing…" / "recording a voice note…"** — real-time, shown in the header and at the bottom of the chat.
- **Search** — the magnifier in the header searches every message back to the start; tapping a result jumps to it, even from months ago.
- **Photo & GIF viewer** — tap any image for a full-screen view. Close with Esc, ✕, tapping outside, or swiping down. Arrow keys / swipe move between photos; Save and Open original included.
- **Settings** (in the side menu) — choose the paper (dots, lines, grid) and the ink (Blueprint, Graphite, Forest, Plum, Night). Saved to your account, so it follows you to other devices. Each person has their own look. You can also change your password here.

---

## Security: Cloudflare Turnstile ("verify you're human") + protecting the site

**What this does:** shows Cloudflare's little "verify you're human" box on the sign-in form (and when changing your password). Bots and password-guessing scripts can't pass it, and **Supabase itself checks it**, so it can't be bypassed by skipping the website.

### Turn it on (about 10 minutes) — do the steps in this order

1. **Create the widget in Cloudflare (free).** Sign in at dash.cloudflare.com → **Turnstile** → **Add widget**.
   - Name: `Updateme`
   - Hostnames: your site's exact address, e.g. `your-app.vercel.app` (add your own domain later if you get one; add `localhost` only if you test locally)
   - Widget mode: **Managed**
   - Copy the **Site Key** (public) and the **Secret Key** (private).
2. **Give the Site Key to the app.** Vercel → your project → **Settings → Environment Variables** → add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Site Key → then **Redeploy** (the value is baked in at build time, so it needs a new deployment). Open the login page: you should now see "Quick security check".
3. **Only now, turn it on in Supabase.** Dashboard → **Authentication** → **Attack Protection** (called **Bot and Abuse Protection** in some dashboard versions) → **Enable CAPTCHA protection** → provider **Cloudflare Turnstile** → paste the **Secret Key** → **Save**.

> **Why this order matters:** once Supabase requires the check, a sign-in without it is refused. If you switch Supabase on *before* the site key is deployed, nobody can sign in until you switch it off again (same toggle) or finish step 2.

If the check doesn't appear or says it couldn't load, it is usually an ad blocker, a VPN or a strict network blocking `challenges.cloudflare.com`.

### Why not put Cloudflare "in front of" the whole site?

- **Vercel advises against it.** Vercel's own guidance is not to use a reverse proxy such as Cloudflare's orange-cloud proxy in front of Vercel: it hides traffic from Vercel's protection, adds latency and often causes SSL errors (525 / 526 "invalid configuration"). Cloudflare **DNS only** (grey cloud) is fine.
- **It wouldn't protect the login anyway.** Sign-ins go from the browser straight to Supabase, not through your website, so a proxy in front of the website never sees them. Turnstile, checked by Supabase, is the layer that does.
- A proxy also needs your own domain; a `*.vercel.app` address can't be proxied by Cloudflare.

### The rest of the protection, in order of importance

1. **Change the starting passwords now** (Settings → Password), and use long, unique ones. The passwords in `create_users.sql` were written down in the project; if the repo is on GitHub, keep it **Private** and remove the passwords from that file. A bot check stops robots, not someone who knows or guesses the password.
2. **Sign-ups are off** (Supabase → Authentication → Sign In / Providers → "Allow new users to sign up" off), and the database only lets Kai and Isha in even if they were on.
3. **Set a minimum password length** of 8–10+ (Supabase → Authentication → Sign In / Providers → Email). Check **Authentication → Rate Limits** too.
4. **Vercel Firewall** (free on every plan): DDoS protection is automatic. If the site is ever attacked, switch on **Attack Challenge Mode** (Vercel → project → **Firewall**), which shows every visitor a browser check. Hobby projects can also have a few free custom rules.
5. **Keep the repository private** and never put the Supabase `service_role` / secret key anywhere in this app.

---

## A sixth theme: Doodle + Fan Page

**Look → Paper → Doodle**, **Look → Ink → Fan Page** — a dark, hand-drawn theme (stars, hearts, sparkles, a scribble, sticker-style message bubbles with a gentle tilt). It's built entirely with original CSS art; nothing traced or copied from anyone's official character art.

The bubble's outline is hand-sketched (a small SVG filter gives it a rough, charcoal wobble instead of a clean rectangle) instead of the flat sticker-card look the other papers use.

**Two optional images, code only — not in Settings.** Add either any time; nothing else to configure, no upload screen, no database. If a file isn't there, that part just doesn't show and everything else looks the same. Redeploy after adding one for it to appear.

- **A personal sticker, peeking out of the corner of each person's bubbles:**
  ```
  public/mascot-kai.png
  public/mascot-isha.png
  ```
  PNG with a transparent background, roughly square, 150–250px works best. Add either or both.

- **A repeating background pattern**, tiled behind the whole conversation and the login page, automatically kept faint so it never competes with the bubbles:
  ```
  public/doodle-pattern.png
  ```
  PNG with a transparent background, designed to tile edge-to-edge (a small motif repeated across a square canvas — 200–260px square is a good size). However bold the source image is, it's always blended down; there's nothing to adjust.

---

## Upgrading to v5 (reply to a message)

Your conversation is safe: v5 only **adds** a column. Nothing is modified or deleted.

1. **Run the SQL first.** Supabase → SQL Editor → New query → paste all of `supabase/migrations/20260924000000_updateme_v5.sql` → Run. *(Run v2 and v3 first if you haven't.)*
2. **Then deploy the new code.** Overwrite the files in your GitHub repo; Vercel redeploys. No new environment variables.

**What's new:** open a message's **⋯** menu → **Reply**. A quoted preview of that message appears above the composer while you write, and once sent, the new message carries a small quoted strip showing what it replied to — tap that strip to jump straight to the original, even if it's far back in the conversation. Replying to an already-unsent message isn't offered, since there'd be nothing left to quote.

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

### 2b. Run the v2 and v3 SQL

New query → paste all of `supabase/migrations/20260921000000_updateme_v2.sql` → Run (voice notes, saved themes). Then the same for `supabase/migrations/20260922000000_updateme_v3.sql` (unsend / delete).

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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | Cloudflare Turnstile Site Key (public). Turns on the "verify you're human" check. See *Security* above |

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
- **Messages are permanent unless someone unsends them.** There are no general edit or delete rights. The *only* way to remove a message is the `unsend_message` function, which works on your own messages only. "Delete for me" just records a private "hidden" note for that person. Signing out never touches messages.
- **Sending is instant and safe to retry.** The browser generates each message's ID, shows it immediately, and reconciles it with the database copy. A retry can never create a duplicate.
- **Live updates.** New messages arrive through Supabase Realtime. If the connection drops (or the tab sleeps), the app reconnects and fetches anything it missed, in order.
- **Voice notes.** Recorded in the browser (max 30 s), converted to a small mono WAV, uploaded to a **private** `chat-voice` bucket with a progress bar, and played through short-lived signed links. The waveform is drawn from a tiny list of loudness values stored with the message.
- **Typing indicator.** Uses Supabase Presence on the same private channel as "Here now". It is never stored and expires by itself if a phone goes to sleep.
- **Search** is a plain-text match over message text, run by the database (so it covers the entire history, not just what is on screen).
- **Images.** Big photos are shrunk in the browser (GIFs are left alone), uploaded to a **private** bucket with a real progress bar, and displayed through short-lived signed links.
- **“Here now”** is real Supabase Presence on a private channel. It shows nothing until the connection is actually up, so it never claims someone is away when it doesn't know.
- **History** loads the newest 40 messages and fetches older ones as you scroll up.

---

## Troubleshooting

**"The security check didn't pass" / can't sign in after enabling CAPTCHA.** Check that the Site Key is in Vercel *and redeployed*, that the widget's Hostnames include your exact site address, and that the Secret Key in Supabase belongs to the *same* widget. To get back in quickly, switch the CAPTCHA toggle off in Supabase.

**“That name and password don't match.”** Run `supabase/create_users.sql` (step 3), and check the password. Names aren't case-sensitive.

**“The database isn't set up yet.”** Run the setup SQL (step 2), then reload.

**“Live updates paused” never goes away.** Messages still send, but realtime isn't connecting. Re-run the setup SQL (it adds `messages` to the realtime publication), and check Dashboard → Database → Publications → `supabase_realtime`.

**No “Here now” indicator.** The presence policies are part of the setup SQL. Re-run it. Everything else works without presence.

**“This page is for two people.”** You signed in with an account that has no profile — use `kai` or `isha`.

**Can't delete a user in the dashboard.** Deliberate: the database refuses to delete someone who has written messages, so history can't disappear by accident. To reset a test setup, first run `truncate public.messages;`.

**Unsend / delete says "Couldn't unsend" or "Couldn't delete".** Run the v3 SQL (it creates the function and the table these use), then try again.

**Voice notes: "Microphone access is blocked".** Click the padlock in the address bar → allow the microphone for this site. (Voice notes need https, which Vercel provides.)

**Voice notes won't send.** Check that the v2 SQL ran (it creates the `chat-voice` bucket).

**Settings won't save / "Couldn't save to your account".** The v2 SQL adds the column that stores your look. Run it, then try again. The look still applies on the device you're using.

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
supabase/            setup SQL, v2 + v3 upgrade SQL, account-creation SQL
```

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`.
