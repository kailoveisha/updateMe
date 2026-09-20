'use client';

import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';

/**
 * Who is looking at the chat right now, using Supabase Realtime Presence.
 *
 * `available` is false until the presence channel has actually connected, so the UI
 * never claims someone is "away" when it simply doesn't know.
 */
export function usePresence(myId: string) {
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(new Set());
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    // Deferred by a tick so React Strict Mode's throw-away first mount never opens a channel.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase.channel('updateme:presence', {
        config: { private: true, presence: { key: myId } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!channel) return;
          setOnlineIds(new Set(Object.keys(channel.presenceState())));
        })
        .subscribe(async (status) => {
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            setAvailable(true);
            await channel?.track({ since: new Date().toISOString() });
          } else if (
            status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            status === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            setAvailable(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) {
        const closing = channel;
        void closing.untrack().finally(() => void supabase.removeChannel(closing));
      }
    };
  }, [myId]);

  return { onlineIds, available };
}
