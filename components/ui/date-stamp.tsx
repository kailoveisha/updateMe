'use client';

import { useIsClient } from '@/hooks/use-is-client';
import { cn } from '@/lib/utils';

/**
 * A rubber date stamp showing today's real date.
 * Rendered only in the browser so the date always matches the viewer's own clock and time zone.
 */
export function DateStamp({ className }: { className?: string }) {
  const isClient = useIsClient();
  const now = isClient ? new Date() : null;

  const weekday = now ? new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(now) : '\u00a0';
  const day = now ? String(now.getDate()) : '\u00a0';
  const monthYear = now ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now) : '\u00a0';

  return (
    <div
      aria-label={now ? `Today is ${weekday}, ${day} ${monthYear}` : undefined}
      className={cn('inline-block rotate-[3deg] select-none opacity-90', className)}
    >
      <div className="border-[1.5px] border-current p-[3px]">
        <div className="border border-current px-3 pb-1.5 pt-1 text-center">
          <div className="text-[11px] font-medium leading-4">{weekday}</div>
          <div className="font-display text-[42px] font-medium leading-[1.05]">{day}</div>
          <div className="text-[11px] font-medium leading-4">{monthYear}</div>
        </div>
      </div>
    </div>
  );
}
