const KEY = 'updateme:recent-emoji';
const LIMIT = 24;

/** Recently used emoji are a per-device convenience only; messages never touch localStorage. */
export function readRecentEmoji(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string): string[] {
  const next = [emoji, ...readRecentEmoji().filter((e) => e !== emoji)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable (private mode) — recents just won't persist */
  }
  return next;
}
