import { Tape } from '@/components/ui/tape';

/** Shown when the conversation has no messages yet: an empty slot on the page, waiting for the first note. */
export function EmptyState({ otherName }: { otherName: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="relative -rotate-[1.5deg] border border-dashed border-ink/50 bg-paper-hi/70 px-8 pb-9 pt-11 sm:px-12">
        <Tape className="-top-2.5 left-1/2 -translate-x-1/2 rotate-[2deg]" />
        <p className="font-display text-[2.1rem] font-medium leading-[1.05] sm:text-[2.6rem]">Nothing here yet.</p>
        <p className="mx-auto mt-3 max-w-[24ch] text-[15px] leading-relaxed text-ink/70 text-balance">
          {otherName ? `A message, a photo or a small emoji. Leave the first update for ${otherName}.` : 'A message, a photo or a small emoji. Leave the first update.'}
        </p>
      </div>

      <div aria-hidden className="mt-5 flex flex-col items-center text-ink/60">
        <p className="rotate-[-3deg] font-hand text-[1.65rem] leading-none">start below</p>
        <svg viewBox="0 0 40 60" className="mt-1 h-12 w-8" fill="none">
          <path d="M22 4c-10 10 8 18-4 30-2 2-4 4-3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 38c4 2 6 5 7 10 3-4 7-7 14-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
