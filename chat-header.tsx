import { Menu, Mic, Search } from 'lucide-react';
import { Monogram } from '@/components/ui/monogram';
import { accentClass, accentOf } from '@/lib/chat/people';
import { cn } from '@/lib/utils';
import type { Activity, Profile } from '@/types/chat';

interface Props {
  other: Profile | null;
  online: boolean;
  presenceKnown: boolean;
  activity: Activity | null;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

export function ChatHeader({ other, online, presenceKnown, activity, onOpenMenu, onOpenSearch }: Props) {
  const accent = accentClass[accentOf(other)];
  return (
    <header className="pt-safe flex items-center gap-3 border-b border-ink/70 bg-paper-hi px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="-ml-2 flex h-10 w-10 items-center justify-center text-ink/75 transition-colors hover:bg-paper-lo hover:text-ink lg:hidden"
      >
        <Menu size={22} strokeWidth={1.6} />
      </button>

      <Monogram person={other} size="lg" />

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-[1.75rem] font-medium leading-[1.05]">{other?.display_name ?? 'Waiting for someone'}</h2>
        <p className="mt-0.5 flex h-4 items-center gap-1.5 text-[13px] leading-none text-ink/65" aria-live="polite">
          {other && activity ? (
            <span className={cn('inline-flex items-center gap-1.5 font-display text-[14.5px] italic', accent.text)}>
              {activity === 'recording' && <Mic size={13} strokeWidth={1.8} aria-hidden />}
              {activity === 'recording' ? 'recording a voice note' : 'writing'}
              <span aria-hidden className="flex items-end gap-[2px] pb-[2px]">
                {[0, 1, 2].map((i) => (
                  <i key={i} className="block h-[4px] w-[4px] animate-bounce-dot rounded-full bg-current" style={{ animationDelay: `${i * 140}ms` }} />
                ))}
              </span>
            </span>
          ) : other && presenceKnown ? (
            <>
              <span aria-hidden className={cn('h-2 w-2 rounded-full border', online ? 'border-moss bg-moss' : 'border-ink/45 bg-transparent')} />
              {online ? 'Here now' : 'Away'}
            </>
          ) : other ? (
            <>A private page for two</>
          ) : (
            <>The other account hasn&apos;t been created yet</>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search this conversation"
        title="Search this conversation"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-ink/75 transition-colors hover:bg-paper-lo hover:text-ink"
      >
        <Search size={22} strokeWidth={1.5} />
      </button>
    </header>
  );
}
