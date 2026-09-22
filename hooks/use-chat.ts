'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';
import { describeError, SessionError } from '@/lib/chat/errors';
import { uploadObject, type PreparedImage } from '@/lib/chat/images';
import {
  fetchAfter,
  fetchBefore,
  fetchPage,
  fetchUnsentSince,
  hasOlderThan,
  hideMessage,
  insertMessage,
  removeFiles,
  unsendMessage,
} from '@/lib/chat/queries';
import { STORAGE_BUCKET, VOICE_BUCKET } from '@/lib/chat/constants';
import type { PreparedVoice } from '@/lib/chat/voice';
import { uuid } from '@/lib/utils';
import type { ChatMessage, ChatStats, ConnectionState, Failure, MessageRow, NewMessage } from '@/types/chat';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface State {
  items: ChatMessage[];
  hasMore: boolean;
  stats: ChatStats;
}

type Action =
  | { type: 'merge'; rows: MessageRow[]; fresh?: boolean }
  | { type: 'prepend'; rows: MessageRow[]; hasMore: boolean }
  | { type: 'pending'; message: ChatMessage }
  | { type: 'update'; id: string; patch: Partial<ChatMessage> }
  | { type: 'remove'; id: string }
  /** A message was unsent for everyone (live event, catch-up, or my own optimistic unsend). */
  | { type: 'tombstone'; row: MessageRow }
  /** "Delete for me": take it off this person's screen. */
  | { type: 'hide'; id: string }
  /** Put a message back exactly as it was (an unsend or hide failed). */
  | { type: 'restore'; message: ChatMessage };

/** Confirmed messages by server time; unsent ones always sit at the bottom in the order they were written. */
function compare(a: ChatMessage, b: ChatMessage): number {
  const aPending = a.status !== 'sent';
  const bPending = b.status !== 'sent';
  if (aPending !== bPending) return aPending ? 1 : -1;
  const at = Date.parse(a.created_at);
  const bt = Date.parse(b.created_at);
  if (at !== bt) return at - bt;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'merge': {
      const byId = new Map(state.items.map((m) => [m.id, m]));
      let added = 0;
      let addedPhotos = 0;
      let firstAt = state.stats.firstAt;

      for (const row of action.rows) {
        const existing = byId.get(row.id);
        if (existing) {
          // Same id ⇒ same message: this is the database confirming (or re-announcing) it. Never a duplicate.
          if (existing.status !== 'sent') {
            if (!row.deleted_at) {
              added += 1;
              if (row.image_path) addedPhotos += 1;
            }
          } else if (row.deleted_at && !existing.deleted_at) {
            added -= 1;
            if (existing.image_path) addedPhotos -= 1;
          }
          byId.set(row.id, {
            ...existing,
            ...row,
            status: 'sent',
            progress: undefined,
            failure: undefined,
          });
        } else {
          byId.set(row.id, { ...row, status: 'sent', fresh: action.fresh });
          if (!row.deleted_at) {
            added += 1;
            if (row.image_path) addedPhotos += 1;
          }
        }
        if (!firstAt || Date.parse(row.created_at) < Date.parse(firstAt)) firstAt = row.created_at;
      }

      return {
        ...state,
        items: Array.from(byId.values()).sort(compare),
        stats: {
          total: state.stats.total + added,
          photos: state.stats.photos + addedPhotos,
          firstAt,
        },
      };
    }
    case 'prepend': {
      const byId = new Map(state.items.map((m) => [m.id, m]));
      for (const row of action.rows) {
        if (!byId.has(row.id)) byId.set(row.id, { ...row, status: 'sent' });
      }
      return { ...state, items: Array.from(byId.values()).sort(compare), hasMore: action.hasMore };
    }
    case 'tombstone': {
      const existing = state.items.find((m) => m.id === action.row.id);
      // Not on screen (older than what's loaded, or hidden by me): it will arrive already unsent when it loads.
      if (!existing || existing.deleted_at || !action.row.deleted_at) return state;
      return {
        ...state,
        items: state.items.map((m) =>
          m.id === existing.id ? { ...m, ...action.row, status: 'sent', progress: undefined, failure: undefined } : m,
        ),
        stats: {
          ...state.stats,
          total: Math.max(0, state.stats.total - 1),
          photos: Math.max(0, state.stats.photos - (existing.image_path ? 1 : 0)),
        },
      };
    }
    case 'hide': {
      const existing = state.items.find((m) => m.id === action.id);
      if (!existing) return state;
      return {
        ...state,
        items: state.items.filter((m) => m.id !== action.id),
        stats: existing.deleted_at
          ? state.stats
          : {
              ...state.stats,
              total: Math.max(0, state.stats.total - 1),
              photos: Math.max(0, state.stats.photos - (existing.image_path ? 1 : 0)),
            },
      };
    }
    case 'restore': {
      const present = state.items.find((m) => m.id === action.message.id);
      const wasCounted = !action.message.deleted_at;
      const isCounted = present ? !present.deleted_at : false;
      const delta = wasCounted && !isCounted ? 1 : 0;
      const photoDelta = delta && action.message.image_path ? 1 : 0;
      return {
        ...state,
        items: [...state.items.filter((m) => m.id !== action.message.id), action.message].sort(compare),
        stats: { ...state.stats, total: state.stats.total + delta, photos: state.stats.photos + photoDelta },
      };
    }
    case 'pending':
      return { ...state, items: [...state.items, action.message].sort(compare) };
    case 'update':
      return {
        ...state,
        items: state.items.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
      };
    case 'remove':
      return { ...state, items: state.items.filter((m) => m.id !== action.id) };
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

interface UseChatArgs {
  myId: string;
  initial: { messages: MessageRow[]; hasMore: boolean; stats: ChatStats };
  onSessionExpired: () => void;
}

interface OutboxEntry {
  payload: NewMessage;
  /** The photo or voice note that must be uploaded before the message row is written. */
  media: { bucket: string; path: string; blob: Blob } | null;
  uploaded: boolean;
  refreshedOnce: boolean;
}

export interface SendInput {
  body: string;
  image?: PreparedImage | null;
  voice?: PreparedVoice | null;
  /** The message this one replies to, if any. */
  replyToId?: string | null;
}

async function accessTokenOf(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new SessionError();
  return data.session.access_token;
}

export function useChat({ myId, initial, onSessionExpired }: UseChatArgs) {
  const [state, dispatch] = useReducer(reducer, initial, (seed): State => ({
    items: seed.messages.map((m) => ({ ...m, status: 'sent' as const })).sort(compare),
    hasMore: seed.hasMore,
    stats: seed.stats,
  }));

  const [realtime, setRealtime] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [online, setOnline] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const itemsRef = useRef(state.items);
  const outbox = useRef(new Map<string, OutboxEntry>());
  const syncing = useRef(false);
  const expiredHandler = useRef(onSessionExpired);
  const hasMoreRef = useRef(state.hasMore);
  // When we last confirmed we were up to date — used to catch up on unsends missed while offline.
  const lastSyncAt = useRef(Date.now() - 2 * 60 * 1000);

  useEffect(() => {
    itemsRef.current = state.items;
    hasMoreRef.current = state.hasMore;
    expiredHandler.current = onSessionExpired;
  });

  /* ---------------- catching up ---------------- */

  /** Fetches anything newer than what we have. Runs on (re)connect, when the tab wakes, and when the network returns. */
  const syncLatest = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const supabase = getBrowserClient();
      const startedAt = Date.now();
      const confirmed = itemsRef.current.filter((m) => m.status === 'sent');
      const newest = confirmed.length > 0 ? confirmed[confirmed.length - 1].created_at : null;
      if (newest) {
        const rows = await fetchAfter(supabase, newest);
        if (rows.length > 0) dispatch({ type: 'merge', rows });
      } else {
        const page = await fetchPage(supabase);
        if (page.rows.length > 0) dispatch({ type: 'merge', rows: page.rows });
      }
      // Older messages may have been unsent while we were away (a 5-minute margin covers clock differences).
      const unsent = await fetchUnsentSince(supabase, new Date(lastSyncAt.current - 5 * 60 * 1000).toISOString());
      for (const row of unsent) dispatch({ type: 'tombstone', row });
      lastSyncAt.current = startedAt;
    } catch {
      // Still offline or Supabase is having a moment — the next reconnect tries again.
    } finally {
      syncing.current = false;
    }
  }, []);

  /* ---------------- sending ---------------- */

  const deliver = useCallback(async (id: string): Promise<void> => {
    const entry = outbox.current.get(id);
    if (!entry) return;

    try {
      const supabase = getBrowserClient();

      if (entry.media && !entry.uploaded) {
        const accessToken = await accessTokenOf(supabase);
        dispatch({ type: 'update', id, patch: { progress: 0 } });
        await uploadObject({
          bucket: entry.media.bucket,
          accessToken,
          path: entry.media.path,
          blob: entry.media.blob,
          onProgress: (percent: number) => dispatch({ type: 'update', id, patch: { progress: percent } }),
        });
        entry.uploaded = true;
      }

      const row = await insertMessage(supabase, entry.payload);
      outbox.current.delete(id);
      dispatch({ type: 'merge', rows: [row] });
    } catch (error) {
      let failure: Failure = describeError(error);

      if (failure.kind === 'session' && !entry.refreshedOnce) {
        entry.refreshedOnce = true;
        const { data } = await getBrowserClient().auth.refreshSession();
        if (data.session) return deliver(id);
      }
      if (failure.kind === 'session') {
        failure = { kind: 'session', message: 'Your session ended. Sign in again to keep going.' };
        expiredHandler.current();
      }
      dispatch({ type: 'update', id, patch: { status: 'failed', failure, progress: undefined } });
    }
  }, []);

  const send = useCallback(
    ({ body, image = null, voice = null, replyToId = null }: SendInput) => {
      const id = uuid();
      const text = body.trim();
      const payload: NewMessage = {
        id,
        sender_id: myId,
        body: text.length > 0 ? text : null,
        image_path: image ? `${myId}/${id}.${image.ext}` : null,
        image_width: image ? image.width : null,
        image_height: image ? image.height : null,
        image_mime: image ? image.mime : null,
        image_size: image ? image.size : null,
        audio_path: voice ? `${myId}/${id}.${voice.ext}` : null,
        audio_duration_ms: voice ? voice.durationMs : null,
        audio_peaks: voice ? voice.peaks : null,
        reply_to_id: replyToId,
      };
      if (!payload.body && !payload.image_path && !payload.audio_path) return;

      const media = image
        ? { bucket: STORAGE_BUCKET, path: payload.image_path as string, blob: image.blob }
        : voice
          ? { bucket: VOICE_BUCKET, path: payload.audio_path as string, blob: voice.blob }
          : null;

      outbox.current.set(id, { payload, media, uploaded: false, refreshedOnce: false });
      dispatch({
        type: 'pending',
        message: {
          ...payload,
          deleted_at: null,
          created_at: new Date().toISOString(),
          status: 'sending',
          progress: media ? 0 : undefined,
          localPreviewUrl: image?.previewUrl ?? voice?.previewUrl,
          fresh: true,
        },
      });
      void deliver(id);
    },
    [deliver, myId],
  );

  const retry = useCallback(
    (id: string) => {
      if (!outbox.current.has(id)) return;
      dispatch({ type: 'update', id, patch: { status: 'sending', failure: undefined } });
      void deliver(id);
    },
    [deliver],
  );

  const discard = useCallback((id: string) => {
    const item = itemsRef.current.find((m) => m.id === id);
    if (!item || item.status === 'sent') return;
    if (item.localPreviewUrl) URL.revokeObjectURL(item.localPreviewUrl);
    outbox.current.delete(id);
    dispatch({ type: 'remove', id });
  }, []);

  /* ---------------- history ---------------- */

  /** Loads the page of messages before the oldest one on screen. Resolves true if anything was added. */
  const loadEarlier = useCallback(async (): Promise<boolean> => {
    if (loadingEarlier || !hasMoreRef.current) return false;
    const oldest = itemsRef.current.find((m) => m.status === 'sent');
    if (!oldest) return false;

    setLoadingEarlier(true);
    setLoadError(null);
    try {
      const page = await fetchPage(getBrowserClient(), oldest.created_at);
      dispatch({ type: 'prepend', rows: page.rows, hasMore: page.hasMore });
      return page.rows.length > 0;
    } catch (error) {
      const failure = describeError(error);
      setLoadError(failure.kind === 'network' ? "Couldn't load earlier messages. Check your connection." : "Couldn't load earlier messages.");
      return false;
    } finally {
      setLoadingEarlier(false);
    }
  }, [loadingEarlier]);

  /* ---------------- unsend / delete ---------------- */

  /** Unsend for everyone. Shows the result at once, and puts the message back if it fails. */
  const unsend = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const item = itemsRef.current.find((m) => m.id === id);
      if (!item || item.status !== 'sent' || item.sender_id !== myId || item.deleted_at) {
        return { ok: false, message: "This message can't be unsent." };
      }

      const optimistic: MessageRow = {
        ...item,
        body: null,
        image_path: null,
        image_width: null,
        image_height: null,
        image_mime: null,
        image_size: null,
        audio_path: null,
        audio_duration_ms: null,
        audio_peaks: null,
        deleted_at: new Date().toISOString(),
      };
      dispatch({ type: 'tombstone', row: optimistic });

      try {
        const supabase = getBrowserClient();
        await unsendMessage(supabase, id);
        // The files are now unused, so they can be removed. A leftover file is harmless if this fails.
        void removeFiles(supabase, STORAGE_BUCKET, [item.image_path]);
        void removeFiles(supabase, VOICE_BUCKET, [item.audio_path]);
        if (item.localPreviewUrl) URL.revokeObjectURL(item.localPreviewUrl);
        return { ok: true };
      } catch (error) {
        dispatch({ type: 'restore', message: item });
        const failure = describeError(error);
        return {
          ok: false,
          message:
            failure.kind === 'network'
              ? "Couldn't unsend. Check your connection and try again."
              : failure.kind === 'session'
                ? 'Your session ended. Sign in again to keep going.'
                : "Couldn't unsend that message. Try again.",
        };
      }
    },
    [myId],
  );

  /** Delete for me: the other person still sees it. */
  const hideForMe = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const item = itemsRef.current.find((m) => m.id === id);
      if (!item || item.status !== 'sent') return { ok: false, message: "This message can't be deleted yet." };

      dispatch({ type: 'hide', id });
      try {
        await hideMessage(getBrowserClient(), myId, id);
        return { ok: true };
      } catch (error) {
        dispatch({ type: 'restore', message: item });
        const failure = describeError(error);
        return {
          ok: false,
          message:
            failure.kind === 'network'
              ? "Couldn't delete. Check your connection and try again."
              : "Couldn't delete that message. Try again.",
        };
      }
    },
    [myId],
  );

  /**
   * Makes sure the conversation on screen reaches back to `targetCreatedAt` (used when jumping to an old
   * search result). Loads in order, so the list never has holes. Resolves true when the target is loaded.
   */
  const loadUntil = useCallback(async (targetCreatedAt: string): Promise<boolean> => {
    const supabase = getBrowserClient();
    let oldest = itemsRef.current.find((m) => m.status === 'sent')?.created_at;
    if (!oldest) return false;
    if (Date.parse(targetCreatedAt) >= Date.parse(oldest)) return true;

    try {
      for (let batch = 0; batch < 20; batch++) {
        const rows = await fetchBefore(supabase, oldest, targetCreatedAt);
        if (rows.length === 0) break;
        oldest = rows[rows.length - 1].created_at;
        dispatch({ type: 'prepend', rows: rows.slice().reverse(), hasMore: true });
        if (rows.length < 500) break;
      }
      const more = await hasOlderThan(supabase, oldest).catch(() => true);
      dispatch({ type: 'prepend', rows: [], hasMore: more });
      return true;
    } catch {
      return false;
    }
  }, []);

  /* ---------------- realtime ---------------- */

  useEffect(() => {
    const supabase = getBrowserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let warned = false;

    // Deferred by a tick so React Strict Mode's throw-away first mount never opens a channel.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`updateme-messages-${uuid()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          dispatch({ type: 'merge', rows: [payload.new as MessageRow], fresh: true });
        })
        // Someone unsent a message: it turns into an "unsent" note on both screens.
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
          dispatch({ type: 'tombstone', row: payload.new as MessageRow });
        })
        // I deleted a message for myself in another tab or device.
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'message_hides', filter: `user_id=eq.${myId}` },
          (payload) => {
            const id = (payload.new as { message_id?: string }).message_id;
            if (id) dispatch({ type: 'hide', id });
          },
        )
        .subscribe((status, error) => {
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            setRealtime('live');
            // Covers the gap between the page loading and the subscription starting, and every reconnect.
            void syncLatest();
          } else if (
            status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            status === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            setRealtime('reconnecting');
            if (!warned && error) {
              warned = true;
              console.warn('[Updateme] Realtime is not connected:', error.message);
            }
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [syncLatest, myId]);

  /* ---------------- network + tab visibility ---------------- */

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      void syncLatest();
      // Anything that failed only because the network was down goes out again by itself.
      for (const item of itemsRef.current) {
        if (item.status === 'failed' && item.failure?.kind === 'network') retry(item.id);
      }
    };
    const handleOffline = () => setOnline(false);
    const handleVisible = () => {
      if (!document.hidden) void syncLatest();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [retry, syncLatest]);

  /* ---------------- cleanup of local image previews ---------------- */

  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        if (item.localPreviewUrl) URL.revokeObjectURL(item.localPreviewUrl);
      }
    },
    [],
  );

  const connection: ConnectionState = useMemo(() => {
    if (!online) return 'offline';
    return realtime;
  }, [online, realtime]);

  return {
    items: state.items,
    hasMore: state.hasMore,
    stats: state.stats,
    connection,
    loadingEarlier,
    loadError,
    send,
    retry,
    discard,
    loadEarlier,
    loadUntil,
    unsend,
    hideForMe,
  };
}
