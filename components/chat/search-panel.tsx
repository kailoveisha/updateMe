'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { SEARCH_MIN_CHARS } from '@/lib/chat/constants';
import { describeError } from '@/lib/chat/errors';
import { formatTime } from '@/lib/chat/format';
import { accentClass, accentOf } from '@/lib/chat/people';
import { searchMessages } from '@/lib/chat/queries';
import { snippetAround } from '@/lib/chat/text';
import { getBrowserClient } from '@/lib/supabase/client';
import type { MessageRow, Profile } from '@/types/chat';

interface Props {
  people: Profile[];
  onJump: (message: MessageRow) => void;
  onClose: () => void;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

/** Search the whole conversation, including messages that aren't loaded on screen yet. */
export function SearchPanel({ people, onJump, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(people.map((p) => [p.id, p]));
  const ready = term.length >= SEARCH_MIN_CHARS;

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Wait for a pause in typing before asking the database.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const ticket = ++run.current;
    setError(null);
    if (term.length < SEARCH_MIN_CHARS) {
      setRows([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchMessages(getBrowserClient(), term)
      .then((result) => {
        if (ticket !== run.current) return;
        setRows(result.rows);
        setHasMore(result.hasMore);
      })
      .catch((e) => {
        if (ticket !== run.current) return;
        setRows([]);
        setError(describeError(e).message);
      })
      .finally(() => ticket === run.current && setLoading(false));
  }, [term]);

  const loadMore = useCallback(async () => {
    const last = rows[rows.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await searchMessages(getBrowserClient(), term, last.created_at);
      setRows((previous) => [...previous, ...result.rows.filter((r) => !previous.some((p) => p.id === r.id))]);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setLoadingMore(false);
    }
  }, [rows, term, loadingMore]);

  return (
    <div role="search" className="animate-fade-in absolute inset-0 z-30 flex flex-col bg-paper-hi">
      <div className="flex items-center gap-2 border-b border-ink/70 px-3 py-3 sm:px-6">
        <Search size={20} strokeWidth={1.6} aria-hidden className="ml-1 shrink-0 text-ink/60" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this conversation"
          aria-label="Search this conversation"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 font-display text-[1.35rem] leading-tight text-ink outline-none placeholder:italic placeholder:text-ink/35 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="p-2 text-ink/55 hover:text-ink">
            <X size={18} strokeWidth={1.8} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-[14.5px] font-semibold underline decoration-marker decoration-[3px] underline-offset-[6px] hover:decoration-ink"
        >
          Done
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto max-w-[46rem]">
          {!ready && (
            <p className="mt-10 text-center font-hand text-[1.7rem] leading-snug text-ink/55">
              type at least {SEARCH_MIN_CHARS} letters
              <span className="mt-1 block font-sans text-[13.5px] not-italic text-ink/50">Searches every message you two have written, back to the start.</span>
            </p>
          )}

          {ready && loading && (
            <p className="mt-10 flex items-center justify-center gap-2.5 text-[14px] text-ink/60">
              <Spinner /> Searching…
            </p>
          )}

          {ready && !loading && error && (
            <p role="alert" className="border-l-[3px] border-pen bg-pen/[0.07] py-2 pl-3 pr-2 text-[14px] text-pen">
              {error}
            </p>
          )}

          {ready && !loading && !error && rows.length === 0 && (
            <div className="mt-10 text-center">
              <p className="font-display text-[1.7rem] leading-tight">Nothing found.</p>
              <p className="mt-1 text-[14px] text-ink/60">No message contains &ldquo;{term}&rdquo;.</p>
            </div>
          )}

          {ready && rows.length > 0 && (
            <>
              <p className="mb-2 text-[13px] text-ink/55" aria-live="polite">
                {rows.length}
                {hasMore ? '+' : ''} {rows.length === 1 && !hasMore ? 'message' : 'messages'}, newest first
              </p>
              <ul className="divide-y divide-dashed divide-ink/25 border-y border-dashed border-ink/25">
                {rows.map((row) => {
                  const author = byId.get(row.sender_id) ?? null;
                  const accent = accentClass[accentOf(author)];
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => onJump(row)}
                        className="group flex w-full items-start gap-3 px-2 py-3.5 text-left transition-colors hover:bg-marker/25 focus-visible:bg-marker/25"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2.5">
                            <span className={`font-display text-[15px] italic leading-none ${accent.text}`}>{author?.display_name ?? 'Someone'}</span>
                            <span className="text-[12.5px] tabular-nums text-ink/55">
                              {dateLabel(row.created_at)}, {formatTime(row.created_at)}
                            </span>
                          </span>
                          <span className="mt-1.5 block text-[15px] leading-snug text-ink/90 [overflow-wrap:anywhere]">
                            {snippetAround(row.body ?? '', term).map((part, i) =>
                              part.match ? (
                                <mark key={i} className="bg-marker/70 px-[1px] text-ink">
                                  {part.text}
                                </mark>
                              ) : (
                                <span key={i}>{part.text}</span>
                              ),
                            )}
                          </span>
                        </span>
                        <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden className="mt-1 shrink-0 text-ink/40 transition-colors group-hover:text-ink" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 border border-ink/40 bg-paper-hi px-4 py-2 text-[13.5px] font-medium text-ink/80 hover:border-ink hover:text-ink"
                  >
                    {loadingMore && <Spinner />}
                    Show older matches
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
