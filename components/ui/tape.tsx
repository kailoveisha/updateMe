import { cn } from '@/lib/utils';

/** A strip of washi tape. Purely decorative, so it is hidden from assistive tech. */
export function Tape({ className }: { className?: string }) {
  return <span aria-hidden className={cn('tape pointer-events-none absolute block h-[18px] w-[68px]', className)} />;
}
