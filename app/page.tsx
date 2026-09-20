import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// The proxy already redirects "/", this is the safety net.
export default async function Home() {
  let signedIn = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabase();
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
    } catch {
      /* fall through to the login page */
    }
  }
  redirect(signedIn ? '/chat' : '/login');
}
