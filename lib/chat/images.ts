import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { UploadError } from './errors';
import { formatBytes } from './format';
import {
  MAX_IMAGE_EDGE,
  MAX_PICK_BYTES,
  MAX_UPLOAD_BYTES,
  SKIP_COMPRESS_UNDER_BYTES,
  STORAGE_BUCKET,
} from './constants';

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

export interface PreparedImage {
  blob: Blob;
  mime: string;
  ext: string;
  width: number;
  height: number;
  size: number;
  /** Object URL for the composer preview and the sender's own bubble. */
  previewUrl: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Reads the first bytes of a file so a renamed .txt can't pass as a .jpg. */
function sniffMime(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

function decode(blob: Blob): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("This image looks damaged and can't be read."));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Validates a picked file and, when it is large, shrinks it in the browser
 * (phone photos are often 5–12 MB). GIFs are never re-encoded so they keep animating.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size === 0) throw new ImageError('That file is empty.');
  if (file.size > MAX_PICK_BYTES) {
    throw new ImageError(`That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_PICK_BYTES)}.`);
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMime(head);
  if (!mime) throw new ImageError('Only JPG, PNG, WEBP and GIF images can be sent.');

  const { image, url } = await decode(file.slice(0, file.size, mime));
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw new ImageError("This image looks damaged and can't be read.");
  }

  const original = (): PreparedImage => {
    if (file.size > MAX_UPLOAD_BYTES) {
      URL.revokeObjectURL(url);
      throw new ImageError(
        mime === 'image/gif'
          ? `That GIF is ${formatBytes(file.size)}. GIFs can be up to ${formatBytes(MAX_UPLOAD_BYTES)}.`
          : `That image is still ${formatBytes(file.size)} after shrinking. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      );
    }
    return {
      blob: file.slice(0, file.size, mime),
      mime,
      ext: EXTENSIONS[mime],
      width,
      height,
      size: file.size,
      previewUrl: url,
    };
  };

  const longest = Math.max(width, height);
  if (mime === 'image/gif' || (file.size <= SKIP_COMPRESS_UNDER_BYTES && longest <= MAX_IMAGE_EDGE)) {
    return original();
  }

  // Shrink: scale down to MAX_IMAGE_EDGE and re-encode.
  const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original();

  const candidates = mime === 'image/jpeg' ? ['image/jpeg'] : ['image/webp', 'image/jpeg'];
  for (const type of candidates) {
    ctx.clearRect(0, 0, targetW, targetH);
    if (type === 'image/jpeg') {
      // JPEG has no transparency; paint white first so transparent PNGs don't turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(image, 0, 0, targetW, targetH);

    for (const quality of [0.88, 0.72]) {
      const out = await toBlob(canvas, type, quality);
      if (!out || out.type !== type) break; // this browser can't encode that format
      if (out.size <= MAX_UPLOAD_BYTES && (out.size < file.size || scale < 1)) {
        URL.revokeObjectURL(url);
        return {
          blob: out,
          mime: type,
          ext: EXTENSIONS[type],
          width: targetW,
          height: targetH,
          size: out.size,
          previewUrl: URL.createObjectURL(out),
        };
      }
    }
  }
  return original();
}

interface UploadArgs {
  accessToken: string;
  path: string;
  blob: Blob;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads to Supabase Storage with real progress events.
 * (supabase-js's own upload() has no progress callback, so this talks to the same
 * REST endpoint directly, using the signed-in user's token — RLS still applies.)
 */
export function uploadImage({ accessToken, path, blob, onProgress }: UploadArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    const endpoint = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;

    const body = new FormData();
    body.append('cacheControl', '31536000');
    body.append('', blob);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.timeout = 2 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () => reject(new UploadError("No connection. It will send again when you're back online.", 'network'));
    xhr.ontimeout = () => reject(new UploadError('The upload took too long. Check your connection and try again.', 'network'));

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      let detail: { statusCode?: string | number; error?: string; message?: string } = {};
      try {
        detail = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      const code = Number(detail.statusCode ?? xhr.status);
      const text = `${detail.error ?? ''} ${detail.message ?? ''}`;

      // The file from an earlier attempt of this same message is already there — that's fine.
      if (code === 409 || /duplicate|already exists/i.test(text)) {
        onProgress?.(100);
        resolve();
      } else if (code === 401 || /jwt/i.test(text)) {
        reject(new UploadError('Your session ended. Sign in again to keep going.', 'session'));
      } else if (code === 403 || /row-level security|unauthorized/i.test(text)) {
        reject(new UploadError("This account isn't allowed to upload images here.", 'rejected'));
      } else if (code === 404 || /bucket not found/i.test(text)) {
        reject(new UploadError("The image storage isn't set up yet. Run the SQL from the README in Supabase.", 'setup'));
      } else if (code === 413 || /too large|exceeded/i.test(text)) {
        reject(new UploadError('That image is too large to upload.', 'rejected'));
      } else if (code === 415 || /mime/i.test(text)) {
        reject(new UploadError('That image type is not supported.', 'rejected'));
      } else {
        reject(new UploadError("The image couldn't be uploaded. Try again.", 'unknown'));
      }
    };

    xhr.send(body);
  });
}
