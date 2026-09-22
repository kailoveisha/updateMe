'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Coffee, Compass, Flower2, Hand, Heart, Shapes, Smile } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EMOJI_CATEGORIES } from '@/lib/chat/emoji';
import { readRecentEmoji, rememberEmoji } from '@/lib/chat/recent-emoji';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  recent: Clock,
  faces: Smile,
  people: Hand,
  hearts: Heart,
  nature: Flower2,
  food: Coffee,
  play: Shapes,
  places: Compass,
};

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
  /** The button that opened the picker — clicking it must not count as an "outside" click. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function EmojiPicker({ onPick, onClose, anchorRef }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState<string>('faces');

  useEffect(() => {
    const stored = readRecentEmoji();
    setRecent(stored);
    if (stored.length > 0) setActive('recent');
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchorRef, onClose]);

  const tabs = [
    ...(recent.length > 0 ? [{ id: 'recent', label: 'Recent', emojis: recent }] : []),
    ...EMOJI_CATEGORIES,
  ];
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Emoji"
      className="animate-pop-in absolute bottom-full left-0 right-0 z-30 mb-2 border border-ink/70 bg-paper-hi shadow-sheet sm:right-auto sm:w-[21.5rem]"
    >
      <div role="tablist" aria-label="Emoji categories" className="flex border-b border-ink/15 px-1">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.id] ?? Smile;
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setActive(tab.id)}
              className={cn(
                'relative flex h-10 flex-1 items-center justify-center transition-colors',
                selected ? 'text-ink' : 'text-ink/45 hover:text-ink/80',
              )}
            >
              <Icon size={18} strokeWidth={1.6} />
              {selected && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] bg-marker" />}
            </button>
          );
        })}
      </div>

      <p className="px-3 pb-1 pt-2.5 font-display text-[15px] italic text-ink/70">{current.label}</p>

      <div role="tabpanel" className="thin-scroll grid h-[13.5rem] grid-cols-8 content-start gap-0.5 overflow-y-auto px-2 pb-2">
        {current.emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => {
              onPick(emoji);
              setRecent(rememberEmoji(emoji));
            }}
            className="flex h-10 items-center justify-center text-[24px] leading-none transition-transform hover:bg-paper-lo active:scale-90"
          >
            <span aria-hidden={false}>{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
