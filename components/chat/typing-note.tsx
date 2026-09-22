import { Mic } from 'lucide-react';
import type { Activity } from '@/types/chat';

/** "Isha is writing…" in her own handwriting, with three little pen dots. */
export function TypingNote({ name, activity }: { name: string; activity: Activity }) {
  const text = activity === 'recording' ? `${name} is recording a voice note` : `${name} is writing`;
  return (
    <div role="status" aria-live="polite" className="animate-fade-in mt-3 flex items-center gap-2 px-1 text-ink/70">
      {activity === 'recording' && <Mic size={16} strokeWidth={1.6} aria-hidden />}
      <span className="font-hand text-[1.55rem] leading-none">{text}</span>
      <span aria-hidden className="flex items-end gap-[3px] pb-[3px]">
        {[0, 1, 2].map((i) => (
          <i key={i} className="block h-[5px] w-[5px] animate-bounce-dot rounded-full bg-ink/60" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </span>
    </div>
  );
}
