/** Emoji-ish characters that may appear in an emoji-only message. */
const NON_TEXT = /[\p{Extended_Pictographic}\u200d\ufe0f\u20e3\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}\s]/gu;

/** True for messages like "😂" or "❤️❤️" — shown large, without a note surface. */
export function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (trimmed.replace(NON_TEXT, '') !== '') return false;
  if (!/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u.test(trimmed)) return false;

  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Segmenter) return trimmed.length <= 12;
  let count = 0;
  for (const part of new Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)) {
    if (part.segment.trim()) count += 1;
  }
  return count > 0 && count <= 3;
}

export interface TextPart {
  type: 'text' | 'link';
  value: string;
}

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

/** Splits text into plain and http(s) link parts. Only http/https links are ever produced. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: 'text', value: text.slice(last, index) });
    parts.push({ type: 'link', value: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
