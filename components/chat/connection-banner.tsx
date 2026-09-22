import { RefreshCw, WifiOff } from 'lucide-react';
import type { ConnectionState } from '@/types/chat';

/** A quiet strip that only appears when live updates aren't flowing. */
export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === 'live' || state === 'connecting') return null;

  const offline = state === 'offline';
  return (
    <div
      role="status"
      className="animate-fade-in flex items-center gap-2.5 border-b border-ink/70 bg-marker/35 px-4 py-2 text-[13.5px] leading-snug sm:px-6"
    >
      {offline ? <WifiOff size={16} strokeWidth={1.8} /> : <RefreshCw size={16} strokeWidth={1.8} className="animate-spin [animation-duration:2.4s]" />}
      <p>
        {offline
          ? "You're offline. Messages you write will send when you're back."
          : 'Live updates paused. Reconnecting, and anything you missed will appear.'}
      </p>
    </div>
  );
}
