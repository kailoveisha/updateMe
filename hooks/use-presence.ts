'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';
import type { Activity } from '@/types/chat';

interface PresenceMeta {
  since?: string;
  activity?: Activity | null;
  at?: number;
}

/** "Typing" that hasn't been refreshed for this long is treated as stopped (e.g. their phone went to sleep). */
const ACTIVITY_TTL_MS = 9_000;
/** While someone keeps typing, we re-announce this often so it doesn't expire. */
const REFRESH_MS = 4_500;

/**
 * Who is looking at the chat right now, and whether they are typing or recording a voice note,
 * using Supabase Realtime Presence on a private channel. Nothing here is stored.
 *
 * `available` is false until the channel has actually connected, so the UI never claims someone
 * is "away" when it simply doesn't know.
 */
export function usePresence(myId: string) {
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(new Set());
  const [activity, setActivityState] = useState<Readonly<Record<string, Activity>>>({});
  const [available, setAvailable] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribed = useRef(false);
  const mine = useRef<{ activity: Activity | null; announcedAt: number }>({ activity: null, announcedAt: 0 });

  /** Reads the channel's state and works out who is here and who is busy. */
  const recompute = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState() as unknown as Record<string, PresenceMeta[]>;
    const now = Date.now();
    const online = new Set<string>();
    const busy: Record<string, Activity> = {};

    for (const [key, metas] of Object.entries(state)) {
      online.add(key);
      const latest = metas
        .filter((m) => m.activity && typeof m.at === 'number' && now - m.at < ACTIVITY_TTL_MS)
        .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
      if (latest?.activity) busy[key] = latest.activity;
    }

    setOnlineIds((previous) => {
      const same = previous.size === online.size && [...online].every((id) => previous.has(id));
      return same ? previous : online;
    });
    setActivityState((previous) => {
      const same =
        Object.keys(busy).length === Object.keys(previous).length &&
        Object.entries(busy).every(([k, v]) => previous[k] === v);
      return same ? previous : busy;
    });
  }, []);

  const announce = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !subscribed.current) return;
    mine.current.announcedAt = Date.now();
    void channel.track({
      since: new Date().toISOString(),
      activity: mine.current.activity,
      at: Date.now(),
    } satisfies PresenceMeta);
  }, []);

  /** Tell the other person what you're doing (or null when you stop). Safe to call on every keystroke. */
  const setActivity = useCallback(
    (next: Activity | null) => {
      const current = mine.current;
      const changed = current.activity !== next;
      const stale = next !== null && Date.now() - current.announcedAt > REFRESH_MS;
      if (!changed && !stale) return;
      current.activity = next;
      announce();
    },
    [announce],
  );

  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;

    // Deferred by a tick so React Strict Mode's throw-away first mount never opens a channel.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      const channel = supabase.channel('updateme:presence', {
        config: { private: true, presence: { key: myId } },
      });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, recompute).subscribe((status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          subscribed.current = true;
          setAvailable(true);
          announce();
        } else if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
          status === REALTIME_SUBSCRIBE_STATES.CLOSED
        ) {
          subscribed.current = false;
          setAvailable(false);
        }
      });
    }, 0);

    // Expire "typing…" that was never cleared.
    const sweep = setInterval(recompute, 3_000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(sweep);
      subscribed.current = false;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void channel.untrack().finally(() => void supabase.removeChannel(channel));
    };
  }, [myId, recompute, announce]);

  return { onlineIds, activity, available, setActivity };
}
