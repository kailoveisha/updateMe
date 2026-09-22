'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageError, prepareImage, type PreparedImage } from '@/lib/chat/images';

/**
 * The image waiting in the composer: picked, validated, shrunk if needed.
 * `take()` hands ownership to a sent message (its preview URL must stay alive);
 * `clear()` throws the attachment away.
 */
export function useAttachment() {
  const [attachment, setAttachment] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const current = useRef<PreparedImage | null>(null);

  useEffect(() => {
    current.current = attachment;
  }, [attachment]);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current.previewUrl);
    },
    [],
  );

  const attach = useCallback(async (files: File | File[] | FileList) => {
    const list = files instanceof File ? [files] : Array.from(files);
    const file = list.find((f) => f.type.startsWith('image/')) ?? list[0];
    if (!file) return;

    setNotice(null);
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setAttachment((previous) => {
        if (previous) URL.revokeObjectURL(previous.previewUrl);
        return prepared;
      });
      if (list.length > 1) setNotice('One image at a time — the first one is attached.');
    } catch (error) {
      setNotice(error instanceof ImageError ? error.message : "That image couldn't be read. Try a different one.");
    } finally {
      setPreparing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setAttachment((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return null;
    });
  }, []);

  const take = useCallback((): PreparedImage | null => {
    const taken = current.current;
    current.current = null;
    setAttachment(null);
    return taken;
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { attachment, preparing, notice, attach, clear, take, dismissNotice, setNotice };
}
