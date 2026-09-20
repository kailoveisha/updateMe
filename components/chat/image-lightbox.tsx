'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { OpenImage } from '@/components/chat/message-item';

/** Full-size view of a shared image. Esc, the backdrop, or the close button dismiss it. */
export function ImageLightbox({ image, onClose }: { image: OpenImage; onClose: () => void }) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image"
      className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-ink/[0.94]"
      onClick={onClose}
    >
      <div className="pt-safe flex items-center justify-end gap-1 p-3" onClick={(e) => e.stopPropagation()}>
        <a
          href={image.src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center gap-2 px-3 text-[14px] text-paper/85 transition-colors hover:bg-paper/10 hover:text-paper"
        >
          <ExternalLink size={17} strokeWidth={1.6} />
          Open original
        </a>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center text-paper/85 transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-paper"
        >
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          onClick={(e) => e.stopPropagation()}
          className="animate-pop-in max-h-full max-w-full border-[6px] border-paper-hi bg-paper-hi object-contain shadow-sheet"
        />
      </div>
    </div>
  );
}
