import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/auth/login-screen';
import { isSupabaseConfigured } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const configured = isSupabaseConfigured();

  let signedIn = false;
  if (configured) {
    try {
      const supabase = await createServerSupabase();
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
    } catch {
      // Supabase unreachable: show the login form; signing in will report the problem clearly.
    }
  }
  if (signedIn) redirect('/chat');

  return <LoginScreen configured={configured} reason={reason} />;
}
