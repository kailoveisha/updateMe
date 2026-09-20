'use client';

import { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';
import { DateStamp } from '@/components/ui/date-stamp';
import { Monogram } from '@/components/ui/monogram';
import { Spinner } from '@/components/ui/spinner';
import { formatCount, formatShortDate } from '@/lib/chat/format';
import { cn } from '@/lib/utils';
import type { ChatStats, Profile } from '@/types/chat';

interface Props {
  people: Profile[];
  meId: string;
  onlineIds: ReadonlySet<string>;
  presenceKnown: boolean;
  stats: ChatStats;
  signingOut: boolean;
  onSignOut: () => void;
  onClose?: () => void;
}

function Leader({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[14.5px]">
      <dt className="text-paper/80">{label}</dt>
      <span aria-hidden className="mb-1 h-px flex-1 border-t border-dotted border-paper/35" />
      <dd className="tabular-nums text-paper">{value}</dd>
    </div>
  );
}

/** The identity panel: wordmark, who is in the conversation, a few real numbers, sign out. */
export function SidebarContent({ people, meId, onlineIds, presenceKnown, stats, signingOut, onSignOut, onClose }: Props) {
  const ordered = [...people].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0));

  return (
    <div className="paper-ink flex h-full flex-col px-7 pb-7 pt-8 text-paper">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-[2.6rem] font-medium leading-none tracking-[-0.035em]">Updateme</p>
          <p aria-hidden className="mt-2 -rotate-[3deg] font-hand text-[1.6rem] leading-none text-marker">
            just us.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-10 w-10 items-center justify-center text-paper/80 hover:bg-paper/10 hover:text-paper focus-visible:outline-paper"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <section className="mt-10" aria-labelledby="in-this-conversation">
        <h2 id="in-this-conversation" className="font-display text-[1.1rem] italic text-paper/85">
          In this conversation
        </h2>
        <ul className="mt-4 space-y-3.5">
          {ordered.map((person) => {
            const here = onlineIds.has(person.id);
            return (
              <li key={person.id} className="flex items-center gap-3">
                <Monogram person={person} size="md" />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[15.5px] font-medium">
                    {person.display_name}
                    {person.id === meId && <span className="font-normal text-paper/60"> (you)</span>}
                  </p>
                  {presenceKnown && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-paper/70">
                      <span
                        aria-hidden
                        className={cn('h-2 w-2 rounded-full border', here ? 'border-moss bg-moss' : 'border-paper/50')}
                      />
                      {here ? 'Here now' : 'Away'}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-9" aria-label="Conversation details">
        <dl className="space-y-2.5 border-t border-paper/30 pt-5">
          <Leader label="Started" value={formatShortDate(stats.firstAt)} />
          <Leader label="Messages" value={formatCount(stats.total)} />
          <Leader label="Photos" value={formatCount(stats.photos)} />
        </dl>
      </section>

      <div className="mt-auto flex items-end justify-between pt-10">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 py-2 text-[14.5px] font-medium text-paper/85 underline decoration-paper/30 underline-offset-[6px] transition-colors hover:text-paper hover:decoration-marker focus-visible:outline-paper disabled:cursor-wait"
        >
          {signingOut ? <Spinner /> : <LogOut size={17} strokeWidth={1.6} />}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <DateStamp className="text-paper/85" />
      </div>
    </div>
  );
}
