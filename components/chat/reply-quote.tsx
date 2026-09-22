import { Mic } from 'lucide-react';
import { accentClass, accentOf } from '@/lib/chat/people';
import { cn } from '@/lib/utils';
import type { ChatMessage, Profile } from '@/types/chat';

interface Props {
  /** The message being replied to, if it's loaded on screen; undefined if it isn't (yet). */
  message: ChatMessage | undefined;
  author: Profile | null;
  onClick: () => void;
  className?: string;
}

/** A one-line summary of what a message contains, for the quoted preview. */
export function summarize(message: Pick<ChatMessage, 'body' | 'image_path' | 'audio_path' | 'deleted_at'>): string {
  if (message.deleted_at) return 'Unsent message';
  if (message.audio_path) return 'Voice note';
  if (message.image_path) return message.body ? `Photo · ${message.body}` : 'Photo';
  return message.body ?? '';
}

/** The small quoted strip inside a bubble, showing what it's replying to. Tap to jump there. */
export function ReplyQuote({ message, author, onClick, className }: Props) {
  const accent = accentClass[accentOf(author)];
  const known = Boolean(message);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1.5 flex w-full items-center gap-1.5 border-l-2 py-1 pl-2 pr-1 text-left transition-colors hover:bg-ink/[0.04]',
        known ? accent.rule : 'border-ink/30',
        className,
      )}
    >
      {message?.audio_path && <Mic size={12} strokeWidth={1.8} className="shrink-0 text-ink/50" aria-hidden />}
      <span className="min-w-0 flex-1 truncate text-[12.5px] leading-tight">
        <span className={cn('font-medium', known && accent.text)}>{author?.display_name ?? (known ? 'Someone' : '')}</span>
        <span className="text-ink/55"> {known ? summarize(message!) : "This message isn't loaded — tap to find it"}</span>
      </span>
    </button>
  );
}
