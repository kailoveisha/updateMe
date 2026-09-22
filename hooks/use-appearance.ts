'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { savePreferences } from '@/lib/chat/queries';
import { applyLook, DEFAULT_LOOK, hasLookPreference, parseLook, type Look } from '@/lib/chat/theme';
import { getBrowserClient } from '@/lib/supabase/client';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The person's chosen paper + colours. Changes show instantly, are remembered on this device (cookie)
 * and saved to their account so they follow them to other devices.
 */
export function useAppearance(userId: string, stored: unknown) {
  const [look, setLookState] = useState<Look>(() => (hasLookPreference(stored) ? parseLook(stored) : DEFAULT_LOOK));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On arrival: an account preference wins (so a new device picks it up); otherwise keep what this device shows.
  useEffect(() => {
    if (hasLookPreference(stored)) {
      const fromAccount = parseLook(stored);
      setLookState(fromAccount);
      applyLook(fromAccount);
    } else {
      const root = document.documentElement;
      setLookState(parseLook({ paper: root.dataset.paper, palette: root.dataset.palette }));
    }
  }, [stored]);

  const setLook = useCallback(
    (next: Look) => {
      setLookState(next);
      applyLook(next);
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await savePreferences(getBrowserClient(), userId, next);
          setSaveState('saved');
        } catch {
          setSaveState('error');
        }
      }, 450);
    },
    [userId],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { look, setLook, saveState };
}
