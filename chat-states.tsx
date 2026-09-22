'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Tape } from '@/components/ui/tape';
import { getBrowserClient } from '@/lib/supabase/client';

function SlipPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="paper-login flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="animate-settle-in relative w-full max-w-md -rotate-[0.8deg] border border-ink/70 bg-paper-hi px-7 pb-8 pt-10 shadow-slip">
        <Tape className="-top-2.5 left-9 -rotate-[4deg]" />
        <h1 className="font-display text-[2rem] font-medium leading-[1.05]">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function useSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await getBrowserClient().auth.signOut({ scope: 'local' });
    } catch {
      /* the local session is cleared regardless */
    }
    router.replace('/login');
    router.refresh();
  };
  return { busy, signOut };
}

const primary =
  'inline-flex h-11 items-center justify-center gap-2 bg-ink px-5 text-[14.5px] font-semibold text-paper-hi transition hover:bg-ink/90 active:translate-y-px disabled:opacity-70';
const quiet = 'py-2 text-[14.5px] font-medium text-ink/70 underline decoration-ink/30 underline-offset-4 hover:text-ink';

export function ChatLoadError({ message }: { message: string }) {
  const router = useRouter();
  const { busy, signOut } = useSignOut();
  return (
    <SlipPage title="Couldn't open the chat">
      <p role="alert" className="mt-4 border-l-[3px] border-pen bg-pen/[0.07] py-2 pl-3 pr-2 text-[14.5px] leading-snug text-pen">
        {message}
      </p>
      <div className="mt-6 flex items-center gap-5">
        <button type="button" onClick={() => router.refresh()} className={primary}>
          <RotateCw size={16} strokeWidth={2} />
          Try again
        </button>
        <button type="button" onClick={signOut} disabled={busy} className={quiet}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </SlipPage>
  );
}

export function NotParticipant({ email }: { email: string | null }) {
  const { busy, signOut } = useSignOut();
  return (
    <SlipPage title="This page is for two people.">
      <p className="mt-4 text-[15px] leading-relaxed text-ink/75">
        {email ? <>You&apos;re signed in as <span className="font-semibold text-ink">{email}</span>, but that account</> : <>This account</>}{' '}
        isn&apos;t part of the conversation. Sign out and use one of the two accounts that belong here.
      </p>
      <button type="button" onClick={signOut} disabled={busy} className={`${primary} mt-6`}>
        {busy && <Spinner />}
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </SlipPage>
  );
}
