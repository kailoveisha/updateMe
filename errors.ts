import type { Failure } from '@/types/chat';

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timed? ?out|econn|enotfound/i;
const SESSION = /jwt expired|invalid jwt|jwt|not authenticated|no active session|auth session missing|refresh token/i;

interface ErrorLike {
  message?: string;
  code?: string | number;
  status?: number;
  statusCode?: string | number;
  name?: string;
}

/** Thrown by our own code when there is no signed-in session. */
export class SessionError extends Error {
  constructor(message = 'Your session has ended.') {
    super(message);
    this.name = 'SessionError';
  }
}

/** Thrown by our own code for upload problems that already have a friendly message. */
export class UploadError extends Error {
  kind: Failure['kind'];
  constructor(message: string, kind: Failure['kind'] = 'unknown') {
    super(message);
    this.name = 'UploadError';
    this.kind = kind;
  }
}

/** Turns any thrown thing into a short, human message plus a category the UI can act on. */
export function describeError(error: unknown): Failure {
  if (error instanceof UploadError) return { kind: error.kind, message: error.message };
  if (error instanceof SessionError) {
    return { kind: 'session', message: 'Your session ended. Sign in again to keep going.' };
  }

  const e: ErrorLike =
    typeof error === 'object' && error !== null ? (error as ErrorLike) : { message: String(error) };
  const message = e.message ?? '';
  const code = String(e.code ?? '');
  const status = Number(e.status ?? e.statusCode ?? 0);

  if (error instanceof TypeError || NETWORK.test(message)) {
    return { kind: 'network', message: "No connection. It will send again when you're back online." };
  }
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303' || SESSION.test(message)) {
    return { kind: 'session', message: 'Your session ended. Sign in again to keep going.' };
  }
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /schema cache|does not exist/i.test(message)) {
    return {
      kind: 'setup',
      message: "The database isn't set up yet. Run the SQL from the README in Supabase, then reload.",
    };
  }
  if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(message)) {
    return { kind: 'rejected', message: "This account isn't allowed to post in this conversation." };
  }
  if (code === '23514') {
    return { kind: 'rejected', message: "This message doesn't fit the rules (empty, or over 4,000 characters)." };
  }
  if (status === 413 || /too large|payload/i.test(message)) {
    return { kind: 'rejected', message: 'That image is too large to upload.' };
  }
  if (status >= 500) {
    return { kind: 'unknown', message: 'Supabase had a hiccup. Try again in a moment.' };
  }
  return { kind: 'unknown', message: "Couldn't send. Try again." };
}
