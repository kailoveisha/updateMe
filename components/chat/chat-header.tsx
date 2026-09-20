import { Menu } from 'lucide-react';
import { Monogram } from '@/components/ui/monogram';
import type { Profile } from '@/types/chat';
import { cn } from '@/lib/utils';

interface Props {
  other: Profile | null;
  online: boolean;
  presenceKnown: boolean;
  onOpenMenu: () => void;
}

export function ChatHeader({ other, online, presenceKnown, onOpenMenu }: Props) {
  return (
    <header className="pt-safe flex items-center gap-3 border-b border-ink/70 bg-paper-hi px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open details"
        className="-ml-2 flex h-10 w-10 items-center justify-center text-ink/75 transition-colors hover:bg-paper-lo hover:text-ink lg:hidden"
      >
        <Menu size={22} strokeWidth={1.6} />
      </button>

      <Monogram person={other} size="lg" />

      <div className="min-w-0">
        <h2 className="truncate font-display text-[1.75rem] font-medium leading-[1.05]">
          {other?.display_name ?? 'Waiting for someone'}
        </h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-none text-ink/65">
          {other && presenceKnown ? (
            <>
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 rounded-full border',
                  online ? 'border-moss bg-moss' : 'border-ink/45 bg-transparent',
                )}
              />
              {online ? 'Here now' : 'Away'}
            </>
          ) : other ? (
            <>A private page for two</>
          ) : (
            <>The other account hasn&apos;t been created yet</>
          )}
        </p>
      </div>
    </header>
  );
}
