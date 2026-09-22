'use client';

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, ImageOff, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { formatBytes } from '@/lib/chat/format';
import type { ChatMessage } from '@/types/chat';

interface Props {
  /** Every photo and GIF in the conversation that is loaded, oldest first. */
  images: ChatMessage[];
  /** Which one to open first. */
  startId: string;
  onClose: () => void;
}

/** Full-screen viewer. Esc, the backdrop, the close button or a swipe down dismiss it; arrows or swipes move between photos. */
export function ImageLightbox({ images, startId, onClose }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((m) => m.id === startId)));
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const current = images[Math.min(index, images.length - 1)];
  const { url, failed, handleError, retry } = useSignedUrl(current?.image_path ?? null, current?.localPreviewUrl);

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(images.length - 1, Math.max(0, i + delta))),
    [images.length],
  );

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, go]);

  // If the photo list changes under us (it shouldn't), never point past the end.
  useEffect(() => {
    if (images.length === 0) onClose();
  }, [images.length, onClose]);

  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose();
  };

  const save = async () => {
    if (!url || !current) return;
    setSaving(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `updateme-${current.id.slice(0, 8)}.${current.image_mime?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer'); // fall back to opening it
    } finally {
      setSaving(false);
    }
  };

  if (!current) return null;
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const iconButton =
    'flex h-11 w-11 items-center justify-center text-snow/85 transition-colors hover:bg-snow/10 hover:text-snow focus-visible:outline-snow';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="animate-fade-in fixed inset-0 z-[60] flex flex-col bg-scrim/[0.95]"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="pt-safe flex items-center gap-1 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
        <p className="mr-auto pl-1 text-[13.5px] tabular-nums text-snow/70">
          {images.length > 1 && (
            <>
              {index + 1} of {images.length}
            </>
          )}
          {current.image_size ? <span className="ml-3">{formatBytes(current.image_size)}</span> : null}
        </p>
        <button type="button" onClick={save} disabled={!url || saving} aria-label="Save image" title="Save" className={iconButton}>
          {saving ? <Spinner className="text-snow" /> : <Download size={20} strokeWidth={1.5} />}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open original in a new tab" title="Open original" className={iconButton}>
            <ExternalLink size={20} strokeWidth={1.5} />
          </a>
        )}
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className={iconButton}>
          <X size={26} strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-8 sm:px-16">
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous image"
            className={`${iconButton} absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 sm:flex`}
          >
            <ChevronLeft size={30} strokeWidth={1.4} />
          </button>
        )}

        {url && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={url}
            alt={current.body ?? 'Shared image'}
            onError={handleError}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in max-h-full max-w-full border-[6px] border-snow bg-snow object-contain shadow-sheet"
          />
        ) : failed ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              retry();
            }}
            className="flex flex-col items-center gap-2 text-snow/80"
          >
            <ImageOff size={30} strokeWidth={1.3} />
            <span className="text-[14px]">Couldn&apos;t load this image. Tap to retry</span>
          </button>
        ) : (
          <Spinner className="h-6 w-6 text-snow/80" />
        )}

        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next image"
            className={`${iconButton} absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 sm:flex`}
          >
            <ChevronRight size={30} strokeWidth={1.4} />
          </button>
        )}
      </div>

      {current.body && (
        <p className="pb-safe mx-auto max-w-[40rem] px-6 pb-4 text-center text-[14.5px] leading-snug text-snow/80" onClick={(e) => e.stopPropagation()}>
          {current.body}
        </p>
      )}
    </div>
  );
}
