'use client';

import { memo } from 'react';
import { AlertCircle, Ban, Check, ImageOff, RotateCw } from 'lucide-react';
import { MascotPeek } from '@/components/chat/mascot-peek';
import { MessageMenu } from '@/components/chat/message-menu';
import { VoiceNote } from '@/components/chat/voice-note';
import { Spinner } from '@/components/ui/spinner';
import { Tape } from '@/components/ui/tape';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { formatTime } from '@/lib/chat/format';
import { accentClass, accentOf } from '@/lib/chat/people';
import { isEmojiOnly, splitLinks } from '@/lib/chat/text';
import { cn, seeded } from '@/lib/utils';
import type { ChatMessage, Profile } from '@/types/chat';

interface Props {
  message: ChatMessage;
  mine: boolean;
  author: Profile | null;
  showLabel: boolean;
  /** Briefly highlight this message (after jumping to it from a search). */
  flash: boolean;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenImage: (messageId: string) => void;
  /** Opens the "Delete this message?" choice. */
  onRequestDelete: (message: ChatMessage) => void;
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

function ImagePrint({ message, onOpen }: { message: ChatMessage; onOpen: (messageId: string) => void }) {
  const { url, failed, handleError, retry } = useSignedUrl(message.image_path, message.localPreviewUrl);
  const width = message.image_width ?? 4;
  const height = message.image_height ?? 3;
  const uploading = message.status === 'sending' && typeof message.progress === 'number';
  const tilt = (seeded(message.id) - 0.5) * 1.6; // a hair off-square, like a pasted print

  return (
    <div className="relative" style={{ transform: `rotate(${tilt.toFixed(2)}deg)` }}>
      <Tape className="-top-2 left-1/2 -translate-x-1/2 -rotate-[3deg]" />
      <div
        className="print-frame relative overflow-hidden border border-ink/25 bg-paper-lo"
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: '26rem', width: 'min(100%, 22rem)' }}
      >
        {url && !failed ? (
          <button
            type="button"
            onClick={() => onOpen(message.id)}
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

function MessageItemImpl({ message, mine, author, showLabel, flash, onRetry, onDiscard, onOpenImage, onRequestDelete }: Props) {
  const accent = accentClass[accentOf(author)];
  const failed = message.status === 'failed';
  const sending = message.status === 'sending';
  const unsent = Boolean(message.deleted_at);
  const hasImage = Boolean(message.image_path);
  const hasVoice = Boolean(message.audio_path);
  const jumbo = !unsent && !hasImage && !hasVoice && message.body !== null && isEmojiOnly(message.body);
  const settled = message.status === 'sent';
  const name = author?.display_name ?? 'Someone';

  // The bubble's shape and colours come from the paper + ink the person chose (see globals.css).
  const bubbleProps = {
    'data-side': mine ? 'mine' : 'theirs',
    'data-accent': accentOf(author),
    'data-flash': flash ? 'true' : undefined,
  } as const;

  return (
    <article
      data-mid={message.id}
      className={cn(
        'flex w-full',
        mine ? 'justify-end' : 'justify-start',
        showLabel ? 'mt-4' : 'mt-1.5',
        message.fresh && 'animate-settle-in',
      )}
    >
      <div className={cn('flex max-w-[min(34rem,86%)] flex-col', mine ? 'items-end' : 'items-start')}>
        {showLabel && (
          <p className={cn('mb-1 px-0.5 font-display text-[15px] italic leading-none', accent.text)}>{name}</p>
        )}

        <div className={cn('group/row relative flex items-center gap-1', mine ? 'flex-row-reverse pr-6' : 'pl-6')}>
          {unsent ? (
            <div {...bubbleProps} className="bubble is-unsent flex min-w-0 items-center gap-2 px-3.5 py-2 text-[14.5px] italic text-ink/60">
              <Ban size={15} strokeWidth={1.6} aria-hidden className="shrink-0" />
              <span>{mine ? 'You unsent a message' : `${name} unsent a message`}</span>
              <time dateTime={message.created_at} className="ml-1 text-[11px] not-italic tabular-nums text-ink/45">
                {formatTime(message.created_at)}
              </time>
            </div>
          ) : jumbo ? (
            <div className={cn('px-1 text-[2.6rem] leading-[1.15]', sending && 'opacity-60')}>
              {message.body}
              <span className="ml-1.5 inline-flex items-center align-middle text-[11px] font-normal text-ink/50">
                {formatTime(message.created_at)}
              </span>
            </div>
          ) : (
            <div
              {...bubbleProps}
              className={cn(
                'bubble min-w-0',
                hasImage ? 'p-2 pb-1.5' : hasVoice ? 'px-3.5 pb-1.5 pt-3' : 'px-3.5 pb-1.5 pt-2.5',
                failed && 'is-failed',
                sending && 'opacity-80',
              )}
            >
              <div className="text-ink">
                {hasImage && <ImagePrint message={message} onOpen={onOpenImage} />}
                {hasVoice && <VoiceNote message={message} />}
                {message.body && (
                  <p className={cn('whitespace-pre-wrap break-words text-[15.5px] leading-[1.5]', hasImage && 'px-1.5 pt-2.5')}>
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

          {settled && !unsent && <MascotPeek person={author} side={mine ? 'mine' : 'theirs'} />}
          {settled && <MessageMenu message={message} mine={mine} side={mine ? 'left' : 'right'} onRequestDelete={onRequestDelete} />}
        </div>

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
              <button type="button" onClick={() => onDiscard(message.id)} className="text-ink/60 underline underline-offset-4 hover:text-ink">
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
