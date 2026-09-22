'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, MoreHorizontal, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  mine: boolean;
  /** Which side of the bubble the "…" button sits on. */
  side: 'left' | 'right';
  onRequestDelete: (message: ChatMessage) => void;
}

/** The small "…" beside a message: copy, delete for me, or (for your own) unsend for everyone. */
export function MessageMenu({ message, mine, side, onRequestDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unsent = Boolean(message.deleted_at);
  const canCopy = !unsent && Boolean(message.body);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const toggle = () => {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      // Open upwards when there isn't room below.
      setOpenUp(rect ? window.innerHeight - rect.bottom < 190 : false);
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.body ?? '');
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        close();
      }, 900);
    } catch {
      close();
    }
  };

  const item =
    'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] transition-colors hover:bg-paper-lo focus-visible:bg-paper-lo';

  return (
    <div ref={rootRef} className="relative shrink-0 self-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Message options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-[opacity,background-color,color] hover:bg-paper-lo hover:text-ink focus-visible:opacity-100',
          open ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 [@media(hover:none)]:opacity-50',
        )}
      >
        <MoreHorizontal size={18} strokeWidth={1.6} />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'animate-pop-in absolute z-20 w-[13.5rem] overflow-hidden border border-ink/70 bg-paper-hi shadow-sheet',
            openUp ? 'bottom-full mb-1' : 'top-full mt-1',
            side === 'left' ? 'right-0' : 'left-0',
          )}
        >
          {canCopy && (
            <button type="button" role="menuitem" onClick={copy} className={item}>
              {copied ? <Check size={16} strokeWidth={1.8} /> : <Copy size={16} strokeWidth={1.6} />}
              {copied ? 'Copied' : 'Copy text'}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onRequestDelete(message);
            }}
            className={cn(item, canCopy && 'border-t border-ink/15')}
          >
            {mine && !unsent ? <Undo2 size={16} strokeWidth={1.6} className="text-pen" /> : <Trash2 size={16} strokeWidth={1.6} className="text-pen" />}
            <span className="text-pen">{mine && !unsent ? 'Delete or unsend…' : 'Delete for me…'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
