export interface Profile {
  id: string;
  username: string;
  display_name: string;
  /** Saved appearance (paper style + colour). Validated before use. */
  preferences?: unknown;
}

/** What someone else is doing in the chat right now (shown live, never stored). */
export type Activity = 'typing' | 'recording';

/** A row of public.messages, exactly as the database returns it. */
export interface MessageRow {
  id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  image_mime: string | null;
  image_size: number | null;
  audio_path: string | null;
  audio_duration_ms: number | null;
  /** 0–100 loudness bars for drawing the voice note's waveform. */
  audio_peaks: number[] | null;
  /** Set when the sender unsent the message for everyone (its content is erased). */
  deleted_at: string | null;
  created_at: string;
}

/** What the client is allowed to insert (created_at is set by the database). */
export type NewMessage = Omit<MessageRow, 'created_at' | 'deleted_at'>;

export type SendStatus = 'sending' | 'sent' | 'failed';

export type FailureKind = 'network' | 'session' | 'rejected' | 'setup' | 'unknown';

export interface Failure {
  kind: FailureKind;
  message: string;
}

/** A message as shown on screen: the database row plus local delivery state. */
export interface ChatMessage extends MessageRow {
  status: SendStatus;
  /** 0–100 while an image is uploading. */
  progress?: number;
  failure?: Failure;
  /** Object URL of the image or voice note the sender just made, so it never re-downloads. */
  localPreviewUrl?: string;
  /** True for messages that arrived live (drives the arrival animation). */
  fresh?: boolean;
}

export interface ChatStats {
  total: number;
  photos: number;
  firstAt: string | null;
}

export type ChatBootstrap =
  | {
      status: 'ready';
      me: Profile;
      /** The signed-in account's email (needed to confirm the current password). */
      email: string | null;
      people: Profile[];
      messages: MessageRow[];
      hasMore: boolean;
      stats: ChatStats;
    }
  | { status: 'error'; message: string }
  | { status: 'not-participant'; email: string | null };

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';
