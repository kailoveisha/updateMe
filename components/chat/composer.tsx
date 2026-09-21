'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ImagePlus, Mic, SendHorizontal, Smile, Square, Trash2, X } from 'lucide-react';
import { EmojiPicker } from '@/components/chat/emoji-picker';
import { WavePlayer } from '@/components/chat/wave-player';
import { Spinner } from '@/components/ui/spinner';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { IMAGE_ACCEPT, LENGTH_WARNING_AT, MAX_MESSAGE_LENGTH, MAX_VOICE_MS } from '@/lib/chat/constants';
import { formatDuration } from '@/lib/chat/duration';
import { formatBytes, formatCount } from '@/lib/chat/format';
import type { PreparedImage } from '@/lib/chat/images';
import type { PreparedVoice } from '@/lib/chat/voice';
import { cn } from '@/lib/utils';
import type { Activity } from '@/types/chat';

interface Props {
  otherName: string | null;
  attachment: PreparedImage | null;
  preparing: boolean;
  notice: string | null;
  onAttach: (files: FileList | File[]) => void;
  onClearAttachment: () => void;
  onDismissNotice: () => void;
  onSend: (body: string, voice: PreparedVoice | null) => void;
  /** Tells the other person you are typing / recording (null = stopped). */
  onActivity: (activity: Activity | null) => void;
}

const MAX_HEIGHT = 168;
const TYPING_IDLE_MS = 2_500;

export function Composer({
  otherName,
  attachment,
  preparing,
  notice,
  onAttach,
  onClearAttachment,
  onDismissNotice,
  onSend,
  onActivity,
}: Props) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flyKey, setFlyKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voice = useVoiceRecorder();

  const trimmed = text.trim();
  const overLimit = text.length > MAX_MESSAGE_LENGTH;
  const canSend = !preparing && !overLimit && (trimmed.length > 0 || attachment !== null);
  const voiceBusy = voice.phase !== 'idle';
  const shownNotice = voice.error ?? notice;

  /* ----- "typing…" for the other person ----- */
  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    onActivity(null);
  }, [onActivity]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    if (value.trim().length === 0) {
      stopTyping();
      return;
    }
    onActivity('typing');
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  // "recording a voice note…" while the microphone is live.
  useEffect(() => {
    if (voice.phase !== 'recording') return;
    onActivity('recording');
    const keepAlive = setInterval(() => onActivity('recording'), 4_000);
    return () => {
      clearInterval(keepAlive);
      onActivity(null);
    };
  }, [voice.phase, onActivity]);

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      onActivity(null);
    },
    [onActivity],
  );

  // Grow with the text, up to a few lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text, voiceBusy]);

  const submit = useCallback(() => {
    if (!canSend) return;
    stopTyping();
    onSend(text, null);
    setText('');
    setFlyKey((n) => n + 1);
    setPickerOpen(false);
    textareaRef.current?.focus();
  }, [canSend, onSend, stopTyping, text]);

  const sendVoice = useCallback(() => {
    const note = voice.take();
    if (!note) return;
    onSend('', note);
    setFlyKey((n) => n + 1);
  }, [onSend, voice]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    // On phones and tablets the Enter key writes a new line; the Send button sends.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    submit();
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      event.preventDefault();
      onAttach(files);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) onAttach(event.target.files);
    event.target.value = ''; // lets the same file be picked again
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    onActivity('typing');
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const dismissNotice = () => {
    voice.dismissError();
    onDismissNotice();
  };

  const remaining = Math.max(0, MAX_VOICE_MS - voice.elapsedMs);

  return (
    <div className="pb-safe relative border-t border-ink/70 bg-paper-hi px-3 pt-3 sm:px-5">
      {shownNotice && (
        <div
          role="alert"
          className="animate-fade-in mb-2.5 flex items-start gap-2 border-l-[3px] border-pen bg-pen/[0.07] py-1.5 pl-3 pr-1.5 text-[13.5px] leading-snug text-pen"
        >
          <span className="flex-1">{shownNotice}</span>
          <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="-my-0.5 p-1 text-pen/70 hover:text-pen">
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {!voiceBusy && (attachment || preparing) && (
        <div className="animate-pop-in mb-2.5 flex items-center gap-3 border border-ink/25 bg-paper p-2">
          {attachment ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.previewUrl} alt="Image ready to send" className="h-14 w-14 shrink-0 border border-ink/20 object-cover" />
              <div className="min-w-0 flex-1 text-[13px] leading-snug">
                <p className="font-medium">Ready to send</p>
                <p className="text-ink/60">
                  {attachment.width} × {attachment.height} px, {formatBytes(attachment.size)}
                </p>
              </div>
            </>
          ) : (
            <div className="flex h-14 flex-1 items-center gap-2.5 px-1 text-[13px] text-ink/70">
              <Spinner />
              <span>Preparing image…</span>
            </div>
          )}
          {attachment && (
            <button
              type="button"
              onClick={onClearAttachment}
              aria-label="Remove image"
              className="p-2 text-ink/60 transition-colors hover:bg-paper-lo hover:text-ink"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}

      {voiceBusy ? (
        /* ---------- voice note: recording / processing / review ---------- */
        <div className="animate-pop-in flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={voice.phase === 'review' ? voice.discard : voice.cancel}
            aria-label="Throw away this voice note"
            title="Throw away"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-ink/70 transition-colors hover:bg-pen/10 hover:text-pen"
          >
            <Trash2 size={20} strokeWidth={1.5} />
          </button>

          <div className="flex min-h-11 min-w-0 flex-1 items-center border border-ink/45 bg-paper px-3 py-1.5">
            {voice.phase === 'starting' && (
              <span className="flex items-center gap-2.5 text-[14px] text-ink/70">
                <Spinner /> Asking for the microphone…
              </span>
            )}

            {voice.phase === 'recording' && (
              <div className="flex w-full items-center gap-3">
                <span aria-hidden className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pen/60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-pen" />
                </span>
                <span className={cn('w-[4.6rem] shrink-0 text-[14px] font-semibold tabular-nums', remaining <= 5000 && 'text-pen')}>
                  {formatDuration(voice.elapsedMs)} / {formatDuration(MAX_VOICE_MS)}
                </span>
                <div aria-hidden className="flex h-7 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
                  {voice.levels.map((level, i) => (
                    <span key={i} className="w-[3px] shrink-0 rounded-[1px] bg-ink/70" style={{ height: `${Math.max(12, level * 100)}%` }} />
                  ))}
                </div>
              </div>
            )}

            {voice.phase === 'processing' && (
              <span className="flex items-center gap-2.5 text-[14px] text-ink/70">
                <Spinner /> Finishing your voice note…
              </span>
            )}

            {voice.phase === 'review' && voice.voice && (
              <WavePlayer src={voice.voice.previewUrl} durationMs={voice.voice.durationMs} peaks={voice.voice.peaks} className="w-full max-w-[26rem]" />
            )}
          </div>

          {voice.phase === 'recording' ? (
            <button
              type="button"
              onClick={() => void voice.stop()}
              aria-label="Stop recording"
              title="Stop"
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-pen text-paper-hi transition active:translate-y-px"
            >
              <Square size={16} strokeWidth={2} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={sendVoice}
              disabled={voice.phase !== 'review'}
              aria-label="Send voice note"
              title="Send voice note"
              className="btn-round flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper-hi transition duration-150 hover:bg-ink/90 active:translate-y-px disabled:bg-ink/20"
            >
              <SendHorizontal size={19} strokeWidth={1.8} />
            </button>
          )}
        </div>
      ) : (
        /* ---------- normal composer ---------- */
        <div className="relative flex items-end gap-1.5 sm:gap-2">
          {pickerOpen && <EmojiPicker onPick={insertEmoji} onClose={closePicker} anchorRef={emojiButtonRef} />}

          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} onChange={handleFile} className="hidden" tabIndex={-1} aria-hidden />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach an image"
            title="Attach an image"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-ink/70 transition-colors hover:bg-paper-lo hover:text-ink"
          >
            <ImagePlus size={21} strokeWidth={1.5} />
          </button>

          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Emoji"
            aria-expanded={pickerOpen}
            title="Emoji"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center transition-colors hover:bg-paper-lo hover:text-ink',
              pickerOpen ? 'bg-paper-lo text-ink' : 'text-ink/70',
            )}
          >
            <Smile size={21} strokeWidth={1.5} />
          </button>

          <div className="relative min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH + 4000}
              placeholder={otherName ? `Leave an update for ${otherName}` : 'Leave an update'}
              aria-label="Message"
              enterKeyHint="enter"
              autoComplete="off"
              className="field-box thin-scroll block max-h-[168px] min-h-11 w-full resize-none border border-ink/45 bg-paper px-3 py-[0.65rem] text-[15.5px] leading-[1.35] text-ink outline-none transition-[background-color,box-shadow,border-color] duration-150 placeholder:italic placeholder:text-ink/40 hover:border-ink/70 focus:border-ink focus:bg-paper-hi focus:shadow-[inset_0_-3px_0_rgb(var(--marker)/0.85)]"
            />
          </div>

          {canSend || preparing || text.length > 0 || attachment ? (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send"
              title="Send (Enter)"
              className="btn-round flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper-hi transition duration-150 hover:bg-ink/90 active:translate-y-px disabled:bg-ink/20 disabled:text-paper-hi/70"
            >
              <span key={flyKey} className={flyKey > 0 ? 'animate-fly' : undefined}>
                <SendHorizontal size={19} strokeWidth={1.8} />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void voice.start()}
              aria-label="Record a voice note (up to 30 seconds)"
              title="Record a voice note (up to 30 seconds)"
              className="btn-round flex h-11 w-11 shrink-0 items-center justify-center border border-ink bg-paper-hi text-ink transition duration-150 hover:bg-ink hover:text-paper-hi active:translate-y-px"
            >
              <Mic size={20} strokeWidth={1.6} />
            </button>
          )}
        </div>
      )}

      <div className="flex h-6 items-center justify-between text-[12px] text-ink/50">
        <span className="hidden sm:inline">
          {voiceBusy ? 'Voice notes can be up to 30 seconds' : 'Enter to send, Shift + Enter for a new line'}
        </span>
        <span className="sm:hidden" />
        {!voiceBusy && text.length >= LENGTH_WARNING_AT && (
          <span className={cn('tabular-nums', overLimit && 'font-semibold text-pen')} aria-live="polite">
            {formatCount(text.length)} / {formatCount(MAX_MESSAGE_LENGTH)}
            {overLimit && ' — too long to send'}
          </span>
        )}
      </div>
    </div>
  );
}
