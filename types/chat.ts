export interface Profile {
  id: string;
  username: string;
  display_name: string;
}

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
  created_at: string;
}

/** What the client is allowed to insert (created_at is set by the database). */
export type NewMessage = Omit<MessageRow, 'created_at'>;

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
  /** Object URL of the image the sender picked, so their own photo never re-downloads. */
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
      people: Profile[];
      messages: MessageRow[];
      hasMore: boolean;
      stats: ChatStats;
    }
  | { status: 'error'; message: string }
  | { status: 'not-participant'; email: string | null };

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';
