'use client';

import { useState } from 'react';
import type { Profile } from '@/types/chat';

interface Props {
  person: Pick<Profile, 'username'> | null;
  side: 'mine' | 'theirs';
}

/**
 * A personal sticker peeking out of the corner of someone's bubble — only on the Doodle paper.
 * Looks for /mascot-<username>.png in the public folder; add the file yourself and it appears,
 * nothing else to configure. Silently shows nothing until (or unless) that file exists.
 */
export function MascotPeek({ person, side }: Props) {
  const [failed, setFailed] = useState(false);
  if (!person || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/mascot-${person.username}.png`}
      alt=""
      aria-hidden
      draggable={false}
      onError={() => setFailed(true)}
      className={`mascot-peek pointer-events-none absolute -bottom-2 z-10 h-14 w-14 select-none object-contain drop-shadow-[1px_2px_0_rgb(var(--shade)/0.45)] ${
        side === 'mine' ? '-right-3 -rotate-6' : '-left-3 rotate-6 -scale-x-100'
      }`}
    />
  );
}
