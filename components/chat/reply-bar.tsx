'use client';

import { Mic, X } from 'lucide-react';
import { accentClass, accentOf } from '@/lib/chat/people';
import { summarize } from '@/components/chat/reply-quote';
import type { ChatMessage, Profile } from '@/types/chat';

interface Props {
  message: ChatMessage;
  author: Profile | null;
  onCancel: () => void;
}

/** Shown above the composer while writing a reply, with the quoted message and a way to cancel. */
export function ReplyBar({ message, author, onCancel }: Props) {
  const accent = accentClass[accentOf(author)];

  return (
    <div className={`mb-2.5 flex items-center gap-2 border-l-2 bg-paper py-1.5 pl-2.5 pr-1.5 ${accent.rule}`}>
      {message.audio_path && <Mic size={13} strokeWidth={1.8} className="shrink-0 text-ink/55" aria-hidden />}
      <div className="min-w-0 flex-1 leading-tight">
        <p className={`text-[12.5px] font-medium ${accent.text}`}>Replying to {author?.display_name ?? 'Someone'}</p>
        <p className="truncate text-[13px] text-ink/65">{summarize(message)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="-my-1 flex h-8 w-8 shrink-0 items-center justify-center text-ink/55 hover:bg-paper-lo hover:text-ink"
      >
        <X size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}
