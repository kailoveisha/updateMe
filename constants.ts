export const STORAGE_BUCKET = 'chat-images';

export const PAGE_SIZE = 40;
export const MAX_MESSAGE_LENGTH = 4000;
export const LENGTH_WARNING_AT = 3600;

/** Largest file we will even try to read (phone photos are big — we shrink them). */
export const MAX_PICK_BYTES = 30 * 1024 * 1024;
/** Largest file that is actually uploaded. Must not exceed the bucket limit in the SQL (8 MB). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2560;
export const SKIP_COMPRESS_UNDER_BYTES = 1.5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

/** Signed image URLs live this long; they are renewed automatically. */
export const SIGNED_URL_SECONDS = 60 * 60;

/** Messages from the same person within this window share one name label. */
export const GROUP_WINDOW_MS = 10 * 60 * 1000;

/** Voice notes */
export const VOICE_BUCKET = 'chat-voice';
export const MAX_VOICE_MS = 30_000;
export const MIN_VOICE_MS = 800;
/** Voice notes are stored as small mono WAV files, which play on every device. */
export const VOICE_SAMPLE_RATE = 24_000;
export const PEAK_COUNT = 48;

/** Search */
export const SEARCH_PAGE_SIZE = 25;
export const SEARCH_MIN_CHARS = 2;
