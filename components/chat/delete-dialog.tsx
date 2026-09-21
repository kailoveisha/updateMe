'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { formatDuration } from '@/lib/chat/duration';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  mine: boolean;
  otherName: string | null;
  /** Runs the chosen action; resolves with an error message, or null on success. */
  onForMe: () => Promise<string | null>;
  onForEveryone: () => Promise<string | null>;
  onClose: () => void;
}

/** "Delete this message?": for you only, or (your own messages) for everyone. */
export function DeleteDialog({ message, mine, otherName, onForMe, onForEveryone, onClose }: Props) {
  const [busy, setBusy] = useState<'me' | 'everyone' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const unsent = Boolean(message.deleted_at);
  const canUnsend = mine && !unsent;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, busy]);

  const run = async (kind: 'me' | 'everyone') => {
    setBusy(kind);
    setError(null);
    const failure = await (kind === 'me' ? onForMe() : onForEveryone());
    if (failure) {
      setError(failure);
      setBusy(null);
    }
    // On success the parent closes this dialog.
  };

  const preview = message.image_path
    ? 'A photo'
    : message.audio_path
      ? `Voice note, ${formatDuration(message.audio_duration_ms ?? 0)}`
      : unsent
        ? 'An unsent message'
        : (message.body ?? '');

  const optionBase =
    'group flex w-full flex-col items-start gap-0.5 border px-4 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
      <button type="button" aria-label="Cancel" disabled={busy !== null} onClick={onClose} className="animate-fade-in absolute inset-0 cursor-default bg-scrim/55" />

      <div className="animate-pop-in relative w-full max-w-[26rem] border border-ink/70 bg-paper-hi shadow-sheet">
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div className="min-w-0">
            <h2 id="delete-title" className="font-display text-[1.7rem] font-medium leading-[1.05]">
              {canUnsend ? 'Delete this message?' : 'Delete for you?'}
            </h2>
            <p className="mt-2 line-clamp-2 border-l-[3px] border-ink/30 pl-3 text-[14px] italic leading-snug text-ink/65 [overflow-wrap:anywhere]">
              {message.audio_path && <Mic size={13} strokeWidth={1.8} aria-hidden className="mr-1.5 inline -translate-y-px" />}
              {preview}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-9 w-9 shrink-0 items-center justify-center text-ink/60 hover:bg-paper-lo hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-2.5 px-6 pb-2">
          {canUnsend && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('everyone')}
              className={cn(optionBase, 'border-pen/70 bg-pen/[0.07] hover:bg-pen/[0.13]')}
            >
              <span className="flex items-center gap-2 text-[15px] font-semibold text-pen">
                {busy === 'everyone' && <Spinner />}
                Unsend for everyone
              </span>
              <span className="text-[13px] leading-snug text-ink/65">
                Removes it for both of you{otherName ? `, including ${otherName}` : ''}. A small &ldquo;unsent&rdquo; note stays in its place.
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('me')}
            className={cn(optionBase, 'border-ink/45 hover:bg-paper-lo')}
          >
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              {busy === 'me' && <Spinner />}
              Delete for me
            </span>
            <span className="text-[13px] leading-snug text-ink/65">
              Removes it from your screen only.{otherName && !unsent ? ` ${otherName} can still see it.` : ''}
            </span>
          </button>
        </div>

        <div className="min-h-[1.5rem] px-6" aria-live="polite">
          {error && (
            <p role="alert" className="mt-2 border-l-[3px] border-pen bg-pen/[0.07] py-1.5 pl-3 pr-2 text-[13.5px] leading-snug text-pen">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 pb-6 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="w-full py-2.5 text-[14.5px] font-medium text-ink/75 underline decoration-ink/30 underline-offset-[6px] hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
