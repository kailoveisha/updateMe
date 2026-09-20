import Link from 'next/link';
import { Tape } from '@/components/ui/tape';

export default function NotFound() {
  return (
    <main className="paper-grid flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-md -rotate-[0.8deg] border border-ink/70 bg-paper-hi px-7 pb-8 pt-10 shadow-slip">
        <Tape className="-top-2.5 left-9 -rotate-[4deg]" />
        <h1 className="font-display text-[2rem] font-medium leading-[1.05]">No page here.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/75">That address doesn&apos;t lead anywhere.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center bg-ink px-5 text-[14.5px] font-semibold text-paper-hi hover:bg-ink/90"
        >
          Back to the chat
        </Link>
      </div>
    </main>
  );
}
