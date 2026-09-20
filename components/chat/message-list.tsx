'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { EmptyState } from '@/components/chat/empty-state';
import { MessageItem, type OpenImage } from '@/components/chat/message-item';
import { Spinner } from '@/components/ui/spinner';
import { GROUP_WINDOW_MS } from '@/lib/chat/constants';
import { dayKey, dayLabel } from '@/lib/chat/format';
import type { ChatMessage, Profile } from '@/types/chat';

interface Props {
  messages: ChatMessage[];
  meId: string;
  people: Profile[];
  otherName: string | null;
  hasMore: boolean;
  loadingEarlier: boolean;
  loadError: string | null;
  onLoadEarlier: () => Promise<boolean>;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenImage: (image: OpenImage) => void;
}

type Row =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage; showLabel: boolean };

const NEAR_BOTTOM = 96;

export function MessageList({
  messages,
  meId,
  people,
  otherName,
  hasMore,
  loadingEarlier,
  loadError,
  onLoadEarlier,
  onRetry,
  onDiscard,
  onOpenImage,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const prevFirst = useRef<string | null>(null);
  const prevLast = useRef<string | null>(null);

  const [unseen, setUnseen] = useState(0);
  const [awayFromBottom, setAwayFromBottom] = useState(false);

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    const out: Row[] = [];
    let previous: ChatMessage | null = null;
    for (const message of messages) {
      const date = new Date(message.created_at);
      const newDay = !previous || dayKey(new Date(previous.created_at)) !== dayKey(date);
      if (newDay) out.push({ kind: 'date', key: `d-${dayKey(date)}`, label: dayLabel(date, now) });

      const gap = previous ? date.getTime() - new Date(previous.created_at).getTime() : Infinity;
      const showLabel = newDay || previous?.sender_id !== message.sender_id || gap > GROUP_WINDOW_MS;
      out.push({ kind: 'message', key: message.id, message, showLabel });
      previous = message;
    }
    return out;
  }, [messages]);

  /* ----- keep the right part of the conversation in view ----- */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = messages[0]?.id ?? null;
    const lastMessage = messages[messages.length - 1];
    const last = lastMessage?.id ?? null;

    if (restore.current && prevFirst.current !== null && first !== prevFirst.current) {
      // Older messages were added above: keep what the reader was looking at exactly where it was.
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
    } else if (last !== prevLast.current) {
      if (prevLast.current === null) {
        el.scrollTop = el.scrollHeight;
      } else if (stickToBottom.current || lastMessage?.sender_id === meId) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else if (lastMessage) {
        setUnseen((n) => n + 1);
      }
    }
    prevFirst.current = first;
    prevLast.current = last;
  }, [messages, meId]);

  /* Images loading, the composer growing, or the phone keyboard opening all change heights. */
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < NEAR_BOTTOM;
    setAwayFromBottom(distance > 240);
    if (distance < NEAR_BOTTOM) setUnseen(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setUnseen(0);
  }, []);

  /* ----- history: load older messages when the top comes into view ----- */
  const loadEarlier = useCallback(async () => {
    const el = scrollRef.current;
    if (!el) return;
    restore.current = { height: el.scrollHeight, top: el.scrollTop };
    const added = await onLoadEarlier();
    if (!added) restore.current = null;
  }, [onLoadEarlier]);

  useEffect(() => {
    const el = scrollRef.current;
    const sentinel = topRef.current;
    if (!el || !sentinel || !hasMore || loadingEarlier || loadError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadEarlier();
      },
      { root: el, rootMargin: '160px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingEarlier, loadError, loadEarlier]);

  const isEmpty = messages.length === 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="paper-ruled thin-scroll absolute inset-0 overflow-y-auto overscroll-contain"
      >
        <div ref={contentRef} className="mx-auto flex min-h-full w-full max-w-[52rem] flex-col px-4 pb-6 pt-6 sm:px-8">
          {isEmpty ? (
            <EmptyState otherName={otherName} />
          ) : (
            <>
              <div ref={topRef} className="flex min-h-9 items-center justify-center pb-2">
                {hasMore ? (
                  loadError ? (
                    <button
                      type="button"
                      onClick={() => void loadEarlier()}
                      className="border border-pen/60 bg-paper-hi px-3 py-1.5 text-[13px] text-pen hover:bg-pen/[0.06]"
                    >
                      {loadError} Tap to retry
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void loadEarlier()}
                      disabled={loadingEarlier}
                      className="inline-flex items-center gap-2 border border-ink/40 bg-paper-hi px-3 py-1.5 text-[13px] font-medium text-ink/75 transition-colors hover:border-ink hover:text-ink"
                    >
                      {loadingEarlier && <Spinner />}
                      {loadingEarlier ? 'Loading earlier updates' : 'Show earlier updates'}
                    </button>
                  )
                ) : (
                  <p aria-hidden className="-rotate-2 font-hand text-[1.5rem] leading-none text-ink/55">
                    this is where it starts
                  </p>
                )}
              </div>

              {rows.map((row) =>
                row.kind === 'date' ? (
                  <div key={row.key} className="mb-1 mt-7 flex items-center gap-3 first:mt-2" role="separator">
                    <span aria-hidden className="h-px flex-1 border-t border-dashed border-ink/30" />
                    <span className="-rotate-1 border border-ink/45 bg-paper-hi px-2.5 py-0.5 text-[12.5px] font-medium text-ink/80">
                      {row.label}
                    </span>
                    <span aria-hidden className="h-px flex-1 border-t border-dashed border-ink/30" />
                  </div>
                ) : (
                  <MessageItem
                    key={row.key}
                    message={row.message}
                    mine={row.message.sender_id === meId}
                    author={peopleById.get(row.message.sender_id) ?? null}
                    showLabel={row.showLabel}
                    onRetry={onRetry}
                    onDiscard={onDiscard}
                    onOpenImage={onOpenImage}
                  />
                ),
              )}
            </>
          )}
        </div>
      </div>

      {awayFromBottom && !isEmpty && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="animate-pop-in absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 border border-ink bg-ink px-3.5 py-2 text-[13px] font-semibold text-paper-hi shadow-sheet transition-transform active:translate-y-px sm:right-8"
        >
          <ArrowDown size={15} strokeWidth={2} />
          {unseen > 0 ? `${unseen} new ${unseen === 1 ? 'update' : 'updates'}` : 'Latest'}
        </button>
      )}
    </div>
  );
}
