import { MAX_VOICE_MS, MIN_VOICE_MS, PEAK_COUNT, VOICE_SAMPLE_RATE } from './constants';

export class VoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceError';
  }
}

export interface PreparedVoice {
  blob: Blob;
  mime: string;
  ext: string;
  durationMs: number;
  /** 0–100 bars used to draw the waveform. */
  peaks: number[];
  size: number;
  /** Object URL for playing it back before and right after sending. */
  previewUrl: string;
}

export interface ActiveRecording {
  /** Stops recording and returns the finished, ready-to-upload voice note. */
  stop: () => Promise<PreparedVoice>;
  /** Stops recording and throws everything away. */
  cancel: () => void;
}

export function voiceSupport(): { ok: true } | { ok: false; reason: string } {
  if (typeof window === 'undefined') return { ok: false, reason: 'Voice notes need a browser.' };
  if (!window.isSecureContext) return { ok: false, reason: 'Voice notes need a secure (https) connection.' };
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return { ok: false, reason: "This browser can't record audio." };
  }
  return { ok: true };
}

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

type AudioContextCtor = typeof AudioContext;
function audioContextCtor(): AudioContextCtor {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new VoiceError("This browser can't process audio.");
  return Ctor;
}

/** Starts the microphone. `onLevel` receives the live loudness (0–1) for the meter. */
export async function beginRecording(onLevel: (level: number) => void): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  // Live meter
  let meterContext: AudioContext | null = null;
  let frame = 0;
  try {
    meterContext = new (audioContextCtor())();
    void meterContext.resume();
    const source = meterContext.createMediaStreamSource(stream);
    const analyser = meterContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      onLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
      frame = requestAnimationFrame(tick);
    };
    tick();
  } catch {
    /* the meter is decoration; recording still works without it */
  }

  const release = () => {
    cancelAnimationFrame(frame);
    stream.getTracks().forEach((track) => track.stop());
    if (meterContext) void meterContext.close().catch(() => undefined);
    meterContext = null;
  };

  recorder.start(250);
  let finished = false;

  return {
    stop: async () => {
      if (finished) throw new VoiceError('This recording has already finished.');
      finished = true;
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      release();
      const raw = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      return encodeVoice(raw);
    },
    cancel: () => {
      finished = true;
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}

function decode(context: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    // Older Safari only supports the callback form; newer browsers return a promise. Handle both.
    const maybe = context.decodeAudioData(data, resolve, reject);
    if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
  });
}

/**
 * Turns whatever the browser recorded (webm / mp4 / ogg) into a small mono WAV.
 * WAV plays on every phone and computer, so a note recorded on one device always plays on the other.
 */
async function encodeVoice(raw: Blob): Promise<PreparedVoice> {
  const data = await raw.arrayBuffer();
  const context = new (audioContextCtor())();
  let decoded: AudioBuffer;
  try {
    decoded = await decode(context, data);
  } catch {
    throw new VoiceError("That recording couldn't be processed. Try again.");
  } finally {
    void context.close().catch(() => undefined);
  }

  const length = Math.max(1, Math.ceil(decoded.duration * VOICE_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, VOICE_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  const maxSamples = Math.floor((MAX_VOICE_MS / 1000) * VOICE_SAMPLE_RATE);
  const samples = rendered.getChannelData(0).subarray(0, maxSamples);
  const durationMs = Math.round((samples.length / VOICE_SAMPLE_RATE) * 1000);

  if (durationMs < MIN_VOICE_MS) throw new VoiceError('Too short. Hold on a little longer.');

  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.004) {
    throw new VoiceError("We couldn't hear anything. Check that your microphone isn't muted.");
  }
  const gain = Math.min(3, Math.max(1, 0.85 / peak)); // lift very quiet recordings

  const blob = new Blob([encodeWav(samples, VOICE_SAMPLE_RATE, gain)], { type: 'audio/wav' });
  return {
    blob,
    mime: 'audio/wav',
    ext: 'wav',
    durationMs,
    peaks: computePeaks(samples, gain),
    size: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}

function encodeWav(samples: Float32Array, rate: number, gain: number): ArrayBuffer {
  const bytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function computePeaks(samples: Float32Array, gain: number): number[] {
  const binSize = Math.max(1, Math.floor(samples.length / PEAK_COUNT));
  const levels: number[] = [];
  for (let bin = 0; bin < PEAK_COUNT; bin++) {
    let sum = 0;
    const start = bin * binSize;
    const end = Math.min(samples.length, start + binSize);
    for (let i = start; i < end; i++) {
      const v = samples[i] * gain;
      sum += v * v;
    }
    levels.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const max = Math.max(...levels, 0.0001);
  return levels.map((v) => Math.max(8, Math.round(Math.pow(v / max, 0.6) * 100)));
}
