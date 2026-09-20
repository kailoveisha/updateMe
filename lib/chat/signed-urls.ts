import { getBrowserClient } from '@/lib/supabase/client';
import { SIGNED_URL_SECONDS, STORAGE_BUCKET } from './constants';

interface Entry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
const waiting = new Map<string, Array<{ resolve: (url: string) => void; reject: (e: unknown) => void }>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const STALE_MARGIN_MS = 2 * 60 * 1000;

function flush() {
  timer = null;
  const batch = Array.from(waiting.entries());
  waiting.clear();
  if (batch.length === 0) return;

  const paths = batch.map(([path]) => path);
  getBrowserClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data) throw error ?? new Error('No signed URLs returned');
      const byPath = new Map(data.map((item) => [item.path ?? '', item]));
      for (const [path, callbacks] of batch) {
        const item = byPath.get(path);
        const signed = item?.signedUrl;
        if (signed) {
          cache.set(path, { url: signed, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 });
          callbacks.forEach((cb) => cb.resolve(signed));
        } else {
          callbacks.forEach((cb) => cb.reject(new Error(item?.error ?? 'Image not found')));
        }
      }
    })
    .catch((error) => {
      for (const [, callbacks] of batch) callbacks.forEach((cb) => cb.reject(error));
    });
}

/**
 * A short-lived URL for a private image. Requests made in the same moment are
 * batched into a single API call, and results are cached until shortly before expiry.
 */
export function getSignedUrl(path: string, { force = false } = {}): Promise<string> {
  const cached = cache.get(path);
  if (!force && cached && cached.expiresAt - Date.now() > STALE_MARGIN_MS) {
    return Promise.resolve(cached.url);
  }
  if (force) cache.delete(path);

  return new Promise((resolve, reject) => {
    const callbacks = waiting.get(path) ?? [];
    callbacks.push({ resolve, reject });
    waiting.set(path, callbacks);
    if (!timer) timer = setTimeout(flush, 25);
  });
}
