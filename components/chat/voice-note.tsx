'use client';

import { WavePlayer } from '@/components/chat/wave-player';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { VOICE_BUCKET } from '@/lib/chat/constants';
import type { ChatMessage } from '@/types/chat';

/** A voice note inside a message: fetches its private file, then shows the waveform player. */
export function VoiceNote({ message }: { message: ChatMessage }) {
  const { url, failed, handleError, retry } = useSignedUrl(message.audio_path, message.localPreviewUrl, VOICE_BUCKET);
  const uploading = message.status === 'sending' && typeof message.progress === 'number';

  return (
    <WavePlayer
      src={url}
      durationMs={message.audio_duration_ms ?? 0}
      peaks={message.audio_peaks}
      failed={failed}
      onRetry={retry}
      onPlaybackError={handleError}
      progress={uploading ? message.progress : undefined}
    />
  );
}
