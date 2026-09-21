'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_MS } from '@/lib/chat/constants';
import { beginRecording, voiceSupport, VoiceError, type ActiveRecording, type PreparedVoice } from '@/lib/chat/voice';

export type VoicePhase = 'idle' | 'starting' | 'recording' | 'processing' | 'review';

const METER_BARS = 40;

function describeMicError(error: unknown): string {
  if (error instanceof VoiceError) return error.message;
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError') return 'Your microphone is being used by another app.';
  return "Couldn't record. Try again.";
}

/** The voice-note flow: record (max 30 s) → review → send or throw away. */
export function useVoiceRecorder() {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [voice, setVoice] = useState<PreparedVoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recording = useRef<ActiveRecording | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelBuffer = useRef<number[]>([]);
  const lastMeter = useRef(0);
  const voiceRef = useRef<PreparedVoice | null>(null);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const reset = useCallback(() => {
    clearTimer();
    recording.current = null;
    levelBuffer.current = [];
    setLevels([]);
    setElapsedMs(0);
    setPhase('idle');
  }, []);

  const finish = useCallback(async () => {
    const active = recording.current;
    if (!active) return;
    recording.current = null;
    clearTimer();
    setPhase('processing');
    try {
      const prepared = await active.stop();
      setVoice(prepared);
      setPhase('review');
    } catch (e) {
      setError(describeMicError(e));
      reset();
    }
  }, [reset]);

  const start = useCallback(async () => {
    if (phase !== 'idle') return;
    setError(null);
    const support = voiceSupport();
    if (!support.ok) {
      setError(support.reason);
      return;
    }

    setPhase('starting');
    try {
      levelBuffer.current = [];
      recording.current = await beginRecording((level) => {
        const now = performance.now();
        if (now - lastMeter.current < 70) return;
        lastMeter.current = now;
        levelBuffer.current = [...levelBuffer.current, level].slice(-METER_BARS);
        setLevels(levelBuffer.current);
      });
      const startedAt = performance.now();
      setElapsedMs(0);
      setPhase('recording');
      timer.current = setInterval(() => {
        const elapsed = performance.now() - startedAt;
        setElapsedMs(Math.min(elapsed, MAX_VOICE_MS));
        if (elapsed >= MAX_VOICE_MS) void finish(); // hard 30-second limit
      }, 100);
    } catch (e) {
      setError(describeMicError(e));
      reset();
    }
  }, [phase, finish, reset]);

  const cancel = useCallback(() => {
    recording.current?.cancel();
    reset();
  }, [reset]);

  const discard = useCallback(() => {
    if (voiceRef.current) URL.revokeObjectURL(voiceRef.current.previewUrl);
    setVoice(null);
    reset();
  }, [reset]);

  /** Hands the finished note to a sent message (which then owns its preview URL). */
  const take = useCallback((): PreparedVoice | null => {
    const taken = voiceRef.current;
    voiceRef.current = null;
    setVoice(null);
    reset();
    return taken;
  }, [reset]);

  useEffect(
    () => () => {
      recording.current?.cancel();
      clearTimer();
      if (voiceRef.current) URL.revokeObjectURL(voiceRef.current.previewUrl);
    },
    [],
  );

  return {
    phase,
    elapsedMs,
    levels,
    voice,
    error,
    dismissError: () => setError(null),
    start,
    stop: finish,
    cancel,
    discard,
    take,
  };
}
