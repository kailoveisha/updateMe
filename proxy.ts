import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env';

/** True when a failure means "couldn't reach Supabase", as opposed to "not signed in". */
function isTransient(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; status?: number; message?: string };
  if (e.name === 'AuthRetryableFetchError') return true;
  if (typeof e.status === 'number' && (e.status === 0 || e.status >= 500)) return true;
  return /fetch failed|network|timeout|ECONN|ENOTFOUND/i.test(e.message ?? '');
}

/**
 * Runs on every page request:
 *  1. refreshes the Supabase session cookies (so sessions don't silently expire),
 *  2. sends signed-out visitors to /login and signed-in visitors to /chat.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, from?: NextResponse) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    const redirect = NextResponse.redirect(url);
    // Carry any refreshed auth cookies (and their no-cache headers) onto the redirect.
    from?.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    from?.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k === 'cache-control' || k === 'expires' || k === 'pragma') redirect.headers.set(key, value);
    });
    return redirect;
  };

  // Not configured yet → the login page explains what is missing.
  if (!isSupabaseConfigured()) {
    return pathname === '/login' ? NextResponse.next({ request }) : redirectTo('/login');
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  let signedIn = false;
  let unreachable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
    unreachable = !data.user && isTransient(error);
  } catch (error) {
    unreachable = isTransient(error);
  }

  // Supabase can't be reached right now: don't bounce a possibly-signed-in person
  // to the login page. The chat page shows a proper "can't connect" message.
  if (unreachable) return response;

  if (pathname === '/') return redirectTo(signedIn ? '/chat' : '/login', response);
  if (pathname.startsWith('/chat') && !signedIn) return redirectTo('/login', response);
  if (pathname === '/login' && signedIn) return redirectTo('/chat', response);

  return response;
}
