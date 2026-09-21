'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { PasswordForm } from '@/components/chat/password-form';
import { Tape } from '@/components/ui/tape';
import type { SaveState } from '@/hooks/use-appearance';
import { PALETTES, PAPERS, type Look } from '@/lib/chat/theme';
import { cn } from '@/lib/utils';

interface Props {
  name: string;
  email: string | null;
  look: Look;
  saveState: SaveState;
  onLookChange: (look: Look) => void;
  onClose: () => void;
}

type Tab = 'look' | 'password';

export function SettingsDialog({ name, email, look, saveState, onLookChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('look');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'look', label: 'Look' },
    { id: 'password', label: 'Password' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" aria-label="Close settings" onClick={onClose} className="animate-fade-in absolute inset-0 cursor-default bg-scrim/55" />

      <div className="animate-pop-in relative flex max-h-[92dvh] w-full max-w-[30rem] flex-col border border-ink/70 bg-paper-hi shadow-sheet sm:-rotate-[0.4deg]">
        <Tape className="-top-2.5 left-10 -rotate-[4deg]" />

        <div className="flex items-start justify-between px-6 pb-2 pt-8">
          <div>
            <h2 id="settings-title" className="font-display text-[2rem] font-medium leading-none">
              Settings
            </h2>
            <p className="mt-2 text-[13.5px] text-ink/60">Signed in as {name}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="-mr-2 -mt-3 flex h-10 w-10 items-center justify-center text-ink/70 transition-colors hover:bg-paper-lo hover:text-ink"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        <div role="tablist" aria-label="Settings sections" className="mx-6 mt-3 flex gap-6 border-b border-ink/25">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative pb-2.5 text-[14.5px] font-medium transition-colors',
                tab === t.id ? 'text-ink' : 'text-ink/50 hover:text-ink/80',
              )}
            >
              {t.label}
              {tab === t.id && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] bg-marker" />}
            </button>
          ))}
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-5">
          {tab === 'look' ? (
            <div className="space-y-7">
              <section aria-labelledby="paper-heading">
                <h3 id="paper-heading" className="font-display text-[1.15rem] italic">
                  Paper
                </h3>
                <div role="radiogroup" aria-labelledby="paper-heading" className="mt-3 grid grid-cols-3 gap-3">
                  {PAPERS.map((paper) => {
                    const selected = look.paper === paper.id;
                    return (
                      <button
                        key={paper.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onLookChange({ ...look, paper: paper.id })}
                        className={cn(
                          'group relative text-left transition-transform active:scale-[0.98]',
                          selected ? '' : 'opacity-90 hover:opacity-100',
                        )}
                      >
                        <span
                          data-style={paper.id}
                          className={cn('paper-preview block h-[4.5rem] w-full', selected && 'outline outline-[2.5px] outline-offset-2 outline-ink')}
                        />
                        <span className="mt-2 block text-[14px] font-semibold leading-none">{paper.label}</span>
                        <span className="mt-1 block text-[12px] leading-tight text-ink/55">{paper.hint}</span>
                        {selected && (
                          <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-marker text-onmarker">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="ink-heading">
                <h3 id="ink-heading" className="font-display text-[1.15rem] italic">
                  Ink
                </h3>
                <div role="radiogroup" aria-labelledby="ink-heading" className="mt-3 grid grid-cols-5 gap-2.5">
                  {PALETTES.map((palette) => {
                    const selected = look.palette === palette.id;
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onLookChange({ ...look, palette: palette.id })}
                        className="group relative text-left transition-transform active:scale-[0.98]"
                      >
                        <span
                          className={cn(
                            'flex h-14 w-full items-center justify-center border border-ink/50',
                            selected && 'outline outline-[2.5px] outline-offset-2 outline-ink',
                          )}
                          style={{ backgroundColor: `rgb(${palette.paper})` }}
                        >
                          <span className="h-7 w-7 -rotate-6 border border-black/10" style={{ backgroundColor: `rgb(${palette.ink})` }} />
                          <span className="-ml-2 h-7 w-7 rotate-3 border border-black/10 bg-marker" />
                        </span>
                        <span className="mt-2 block text-[13.5px] font-semibold leading-none">{palette.label}</span>
                        {selected && (
                          <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-marker text-onmarker">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <p className="text-[12.5px] leading-snug text-ink/55" aria-live="polite">
                {saveState === 'saving' && 'Saving…'}
                {saveState === 'saved' && 'Saved to your account. It follows you to your other devices.'}
                {saveState === 'error' && "Applied here, but couldn't be saved to your account. Check your connection."}
                {saveState === 'idle' && 'This is only for you. The other person keeps their own look.'}
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-5 text-[14px] leading-relaxed text-ink/70">
                Choose a new password for signing in. You&apos;ll be asked for the current one first.
              </p>
              <PasswordForm email={email} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
