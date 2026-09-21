import { getBrowserClient } from '@/lib/supabase/client';
import { SIGNED_URL_SECONDS, STORAGE_BUCKET } from './constants';

interface Entry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
interface Waiter {
  resolve: (url: string) => void;
  reject: (e: unknown) => void;
}
// Requests are grouped per bucket, then per file path.
const waiting = new Map<string, Map<string, Waiter[]>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const STALE_MARGIN_MS = 2 * 60 * 1000;

function flush() {
  timer = null;
  const batches = Array.from(waiting.entries());
  waiting.clear();

  for (const [bucket, files] of batches) {
    const batch = Array.from(files.entries());
    if (batch.length === 0) continue;

    getBrowserClient()
      .storage.from(bucket)
      .createSignedUrls(
        batch.map(([path]) => path),
        SIGNED_URL_SECONDS,
      )
      .then(({ data, error }) => {
        if (error || !data) throw error ?? new Error('No signed URLs returned');
        const byPath = new Map(data.map((item) => [item.path ?? '', item]));
        for (const [path, callbacks] of batch) {
          const item = byPath.get(path);
          const signed = item?.signedUrl;
          if (signed) {
            cache.set(`${bucket}/${path}`, { url: signed, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 });
            callbacks.forEach((cb) => cb.resolve(signed));
          } else {
            callbacks.forEach((cb) => cb.reject(new Error(item?.error ?? 'File not found')));
          }
        }
      })
      .catch((error) => {
        for (const [, callbacks] of batch) callbacks.forEach((cb) => cb.reject(error));
      });
  }
}

/**
 * A short-lived URL for a private file (photo or voice note). Requests made in the same
 * moment are batched into a single API call, and results are cached until shortly before expiry.
 */
export function getSignedUrl(
  path: string,
  { force = false, bucket = STORAGE_BUCKET }: { force?: boolean; bucket?: string } = {},
): Promise<string> {
  const key = `${bucket}/${path}`;
  const cached = cache.get(key);
  if (!force && cached && cached.expiresAt - Date.now() > STALE_MARGIN_MS) {
    return Promise.resolve(cached.url);
  }
  if (force) cache.delete(key);

  return new Promise((resolve, reject) => {
    const files = waiting.get(bucket) ?? new Map<string, Waiter[]>();
    const callbacks = files.get(path) ?? [];
    callbacks.push({ resolve, reject });
    files.set(path, callbacks);
    waiting.set(bucket, files);
    if (!timer) timer = setTimeout(flush, 25);
  });
}
