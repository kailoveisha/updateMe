import { accentClass, accentOf, initialOf } from '@/lib/chat/people';
import type { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';

interface Props {
  person: Pick<Profile, 'username' | 'display_name'> | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-7 w-7 text-[17px]',
  md: 'h-9 w-9 text-[22px]',
  lg: 'h-12 w-12 text-[30px]',
};

/** A person's avatar: their initial on a small square of paper, in their own ink colour. */
export function Monogram({ person, size = 'md', className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 -rotate-3 select-none items-center justify-center border border-ink/70 bg-paper-hi font-display italic leading-none shadow-[1px_2px_0_rgb(var(--ink)/0.14)]',
        SIZES[size],
        accentClass[accentOf(person)].text,
        className,
      )}
    >
      {initialOf(person)}
    </span>
  );
}
