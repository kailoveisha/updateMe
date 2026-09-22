/**
 * Environment access in one place.
 *
 * NEXT_PUBLIC_* variables must be referenced with the literal
 * `process.env.NEXT_PUBLIC_…` form so Next.js can inline them into the browser bundle.
 */

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');

// Supabase now calls this the "publishable" key; older projects call it the "anon" key. Both work.
const rawKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

export const SUPABASE_URL = rawUrl;
export const SUPABASE_ANON_KEY = rawKey;

/** People type a name ("kai"); it becomes kai@<this domain> for Supabase Auth. */
export const LOGIN_EMAIL_DOMAIN = (process.env.NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN ?? 'updateme.local')
  .trim()
  .toLowerCase()
  .replace(/^@/, '');

export function isSupabaseConfigured(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Cloudflare Turnstile ("verify you're human") site key. It is public by design.
 * Optional: when it isn't set, no check is shown and the app works exactly as before.
 * (The matching SECRET key goes into Supabase, never into this app.)
 */
export const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
