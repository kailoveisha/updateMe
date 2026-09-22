'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ImageOff, Pause, Play } from 'lucide-react';
import { formatDuration } from '@/lib/chat/duration';
import { cn } from '@/lib/utils';

interface Props {
  src: string | null;
  durationMs: number;
  peaks: number[] | null;
  /** Loading the audio URL failed and can be retried. */
  failed?: boolean;
  onRetry?: () => void;
  /** Called when the browser can't play the file (e.g. an expired link). */
  onPlaybackError?: () => void;
  /** Upload progress 0–100 while a sent note is still uploading. */
  progress?: number;
  /** Colour the played part of the waveform. */
  className?: string;
}

const FALLBACK_PEAKS = Array.from({ length: 40 }, (_, i) => 30 + ((i * 37) % 40));

// Only one voice note plays at a time.
let playing: HTMLAudioElement | null = null;

export function WavePlayer({ src, durationMs, peaks, failed, onRetry, onPlaybackError, progress, className }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const frame = useRef(0);

  const bars = peaks && peaks.length > 0 ? peaks : FALLBACK_PEAKS;
  const ratio = durationMs > 0 ? Math.min(1, position / durationMs) : 0;

  const stopLoop = () => cancelAnimationFrame(frame.current);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      setPosition(audio.currentTime * 1000);
      frame.current = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      if (playing && playing !== audio) playing.pause();
      playing = audio;
      setIsPlaying(true);
      stopLoop();
      frame.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPlaying(false);
      stopLoop();
      if (playing === audio) playing = null;
    };
    const onEnded = () => {
      setIsPlaying(false);
      setPosition(0);
      stopLoop();
      audio.currentTime = 0;
      if (playing === audio) playing = null;
    };
    const onError = () => {
      setIsPlaying(false);
      stopLoop();
      onPlaybackError?.();
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      stopLoop();
      audio.pause();
      if (playing === audio) playing = null;
    };
  }, [onPlaybackError]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [src]);

  const seekTo = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      audio.currentTime = (clamped * durationMs) / 1000;
      setPosition(clamped * durationMs);
    },
    [durationMs],
  );

  const onWaveClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo((event.clientX - rect.left) / rect.width);
  };

  const onWaveKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') seekTo(ratio + 5000 / durationMs);
    else if (event.key === 'ArrowLeft') seekTo(ratio - 5000 / durationMs);
    else return;
    event.preventDefault();
  };

  if (failed) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex w-[15rem] items-center gap-2.5 py-1 text-left text-[13px] text-ink/70 hover:text-ink"
      >
        <ImageOff size={18} strokeWidth={1.5} />
        Couldn&apos;t load this voice note. Tap to retry
      </button>
    );
  }

  return (
    <div className={cn('w-[min(17rem,64vw)]', className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src ?? undefined} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!src}
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper-hi transition active:scale-95 disabled:opacity-40"
        >
          {isPlaying ? <Pause size={17} strokeWidth={2} fill="currentColor" /> : <Play size={17} strokeWidth={2} fill="currentColor" className="translate-x-px" />}
        </button>

        <div className="min-w-0 flex-1">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Voice note position"
            aria-valuemin={0}
            aria-valuemax={Math.round(durationMs / 1000)}
            aria-valuenow={Math.round(position / 1000)}
            aria-valuetext={`${formatDuration(position)} of ${formatDuration(durationMs)}`}
            onClick={onWaveClick}
            onKeyDown={onWaveKey}
            className="flex h-8 cursor-pointer items-center gap-[2px]"
          >
            {bars.map((value, index) => {
              const played = (index + 0.5) / bars.length <= ratio;
              return (
                <span
                  key={index}
                  aria-hidden
                  className={cn('w-[3px] shrink-0 rounded-[1px] transition-colors duration-100', played ? 'bg-ink' : 'bg-ink/25')}
                  style={{ height: `${Math.max(12, value)}%`, flex: '1 1 0' }}
                />
              );
            })}
          </div>
          <p className="mt-0.5 text-[11.5px] tabular-nums leading-none text-ink/55">
            {isPlaying || position > 0 ? formatDuration(position) : formatDuration(durationMs)}
            {isPlaying || position > 0 ? ` / ${formatDuration(durationMs)}` : ''}
          </p>
        </div>
      </div>

      {typeof progress === 'number' && progress < 100 && (
        <div className="mt-2 h-[3px] bg-ink/15">
          <div className="h-full bg-ink transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
