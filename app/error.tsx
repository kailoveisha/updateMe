'use client';

import { useEffect } from 'react';
import { Tape } from '@/components/ui/tape';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="paper-login flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-md -rotate-[0.8deg] border border-ink/70 bg-paper-hi px-7 pb-8 pt-10 shadow-slip">
        <Tape className="-top-2.5 left-9 -rotate-[4deg]" />
        <h1 className="font-display text-[2rem] font-medium leading-[1.05]">Something slipped.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
          The page hit an unexpected problem. Your messages are safe. Try again, and if it keeps happening, reload.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center bg-ink px-5 text-[14.5px] font-semibold text-paper-hi hover:bg-ink/90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
