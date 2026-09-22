'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_BUCKET } from '@/lib/chat/constants';
import { getSignedUrl } from '@/lib/chat/signed-urls';

interface Result {
  url: string | null;
  failed: boolean;
  /** Call from <img onError>: renews an expired URL once, then gives up so the UI can offer a retry. */
  handleError: () => void;
  retry: () => void;
}

/** Resolves a storage path to a displayable URL. A local preview (the sender's own photo) wins. */
export function useSignedUrl(path: string | null, localPreviewUrl?: string, bucket: string = STORAGE_BUCKET): Result {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const renewed = useRef(false);

  const load = useCallback(
    (force: boolean) => {
      if (!path) return;
      setFailed(false);
      getSignedUrl(path, { force, bucket })
        .then((next) => setUrl(next))
        .catch(() => setFailed(true));
    },
    [path, bucket],
  );

  useEffect(() => {
    if (localPreviewUrl || !path) return;
    renewed.current = false;
    let cancelled = false;
    getSignedUrl(path, { bucket })
      .then((next) => !cancelled && setUrl(next))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [path, localPreviewUrl, bucket]);

  const handleError = useCallback(() => {
    if (localPreviewUrl) return;
    if (!renewed.current) {
      renewed.current = true;
      load(true);
    } else {
      setFailed(true);
    }
  }, [load, localPreviewUrl]);

  const retry = useCallback(() => {
    renewed.current = false;
    load(true);
  }, [load]);

  return { url: localPreviewUrl ?? url, failed: !localPreviewUrl && failed, handleError, retry };
}
