'use client';

import { memo } from 'react';
import { AlertCircle, Check, ImageOff, RotateCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Tape } from '@/components/ui/tape';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { formatTime } from '@/lib/chat/format';
import { accentClass, accentOf } from '@/lib/chat/people';
import { isEmojiOnly, splitLinks } from '@/lib/chat/text';
import { cn, seeded } from '@/lib/utils';
import type { ChatMessage, Profile } from '@/types/chat';

export interface OpenImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

interface Props {
  message: ChatMessage;
  mine: boolean;
  author: Profile | null;
  showLabel: boolean;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenImage: (image: OpenImage) => void;
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline decoration-ink/40 underline-offset-2 hover:decoration-ink"
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

function ImagePrint({ message, onOpen }: { message: ChatMessage; onOpen: (image: OpenImage) => void }) {
  const { url, failed, handleError, retry } = useSignedUrl(message.image_path, message.localPreviewUrl);
  const width = message.image_width ?? 4;
  const height = message.image_height ?? 3;
  const uploading = message.status === 'sending' && typeof message.progress === 'number';
  const tilt = (seeded(message.id) - 0.5) * 1.6; // a hair off-square, like a pasted print

  return (
    <div className="relative" style={{ transform: `rotate(${tilt.toFixed(2)}deg)` }}>
      <Tape className="-top-2 left-1/2 -translate-x-1/2 -rotate-[3deg]" />
      <div
        className="relative overflow-hidden border border-ink/25 bg-paper-lo"
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: '26rem', width: 'min(100%, 22rem)' }}
      >
        {url && !failed ? (
          <button
            type="button"
            onClick={() => onOpen({ src: url, width, height, alt: message.body ?? 'Shared image' })}
            className="block h-full w-full cursor-zoom-in"
            aria-label="Open image full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={message.body ?? 'Shared image'}
              width={width}
              height={height}
              decoding="async"
              onError={handleError}
              className={cn('h-full w-full object-cover transition-opacity duration-200', uploading && 'opacity-60')}
            />
          </button>
        ) : failed ? (
          <button
            type="button"
            onClick={retry}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[13px] text-ink/65 hover:text-ink"
          >
            <ImageOff size={22} strokeWidth={1.5} />
            <span>Couldn&apos;t load. Tap to retry</span>
          </button>
        ) : (
          <div aria-hidden className="h-full w-full animate-pulse bg-ink/[0.06]" />
        )}

        {uploading && (
          <div className="absolute inset-x-0 bottom-0">
            <div className="flex items-center justify-end px-2 pb-1 text-[11px] font-semibold tabular-nums text-ink">
              {message.progress}%
            </div>
            <div className="h-[3px] bg-ink/15">
              <div className="h-full bg-ink transition-[width] duration-150" style={{ width: `${message.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageItemImpl({ message, mine, author, showLabel, onRetry, onDiscard, onOpenImage }: Props) {
  const accent = accentClass[accentOf(author)];
  const failed = message.status === 'failed';
  const sending = message.status === 'sending';
  const hasImage = Boolean(message.image_path);
  const jumbo = !hasImage && message.body !== null && isEmojiOnly(message.body);

  return (
    <article
      className={cn(
        'flex w-full',
        mine ? 'justify-end' : 'justify-start',
        showLabel ? 'mt-4' : 'mt-1.5',
        message.fresh && 'animate-settle-in',
      )}
    >
      <div className={cn('flex max-w-[min(34rem,86%)] flex-col', mine ? 'items-end' : 'items-start')}>
        {showLabel && (
          <p className={cn('mb-1 px-0.5 font-display text-[15px] italic leading-none', accent.text)}>
            {author?.display_name ?? 'Someone'}
          </p>
        )}

        {jumbo ? (
          <div className={cn('px-1 text-[2.6rem] leading-[1.15]', sending && 'opacity-60')}>
            {message.body}
            <span className="ml-1.5 inline-flex items-center align-middle text-[11px] font-normal text-ink/50">
              {formatTime(message.created_at)}
            </span>
          </div>
        ) : (
          <div
            className={cn(
              'relative min-w-0 border-ink/70 shadow-slip',
              accent.slip,
              hasImage ? 'p-2 pb-1.5' : 'px-3.5 pb-1.5 pt-2.5',
              mine ? 'border border-r-[3px]' : 'border border-l-[3px]',
              mine ? 'border-r-current' : accent.rule,
              mine && accent.text,
              failed && 'border-dashed',
              sending && 'opacity-80',
            )}
          >
            <div className="text-ink">
              {hasImage && <ImagePrint message={message} onOpen={onOpenImage} />}
              {message.body && (
                <p
                  className={cn(
                    'whitespace-pre-wrap break-words text-[15.5px] leading-[1.5]',
                    hasImage && 'px-1.5 pt-2.5',
                  )}
                >
                  <RichText text={message.body} />
                </p>
              )}

              <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] leading-5 text-ink/50">
                {sending && (
                  <>
                    <Spinner className="h-3 w-3" />
                    <span>Sending</span>
                  </>
                )}
                {!sending && !failed && (
                  <>
                    <time dateTime={message.created_at} className="tabular-nums">
                      {formatTime(message.created_at)}
                    </time>
                    {mine && <Check size={13} strokeWidth={2} aria-label="Sent" />}
                  </>
                )}
                {failed && (
                  <span className="inline-flex items-center gap-1 font-medium text-pen">
                    <AlertCircle size={13} strokeWidth={2} />
                    Not sent
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {failed && (
          <div role="alert" className="mt-1.5 max-w-full text-[13px] leading-snug text-ink/75">
            <p className="text-pen">{message.failure?.message ?? "This message didn't send."}</p>
            <div className="mt-1 flex items-center gap-4">
              {message.failure?.kind !== 'session' && (
                <button
                  type="button"
                  onClick={() => onRetry(message.id)}
                  className="inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-marker decoration-[3px] underline-offset-4 hover:decoration-ink"
                >
                  <RotateCw size={13} strokeWidth={2} />
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => onDiscard(message.id)}
                className="text-ink/60 underline underline-offset-4 hover:text-ink"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export const MessageItem = memo(MessageItemImpl);
