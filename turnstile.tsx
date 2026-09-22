'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const WIDGET_WIDTH = 300;
const WIDGET_HEIGHT = 65;

let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once for the whole page. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
      script.onerror = () => {
        loading = null; // allow a later retry
        script.remove();
        reject(new Error('Turnstile blocked'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

interface Props {
  siteKey: string;
  /** Called with a fresh one-time token when the check passes, and with null when it expires or fails. */
  onToken: (token: string | null) => void;
  /** Change this number to make the widget run again (tokens can only be used once). */
  resetSignal?: number;
}

/** Cloudflare's "verify you're human" check. Supabase verifies the token on its side. */
export function Turnstile({ siteKey, onToken, resetSignal = 0 }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const tokenCallback = useRef(onToken);
  const [status, setStatus] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    tokenCallback.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        const holder = holderRef.current;
        if (cancelled || !holder) return;
        const dark = document.documentElement.dataset.palette === 'night';
        widgetRef.current = api.render(holder, {
          sitekey: siteKey,
          theme: dark ? 'dark' : 'light',
          size: 'normal',
          language: 'auto',
          'refresh-expired': 'auto',
          callback: (token: string) => tokenCallback.current(token),
          'expired-callback': () => tokenCallback.current(null),
          'timeout-callback': () => tokenCallback.current(null),
          'error-callback': () => tokenCallback.current(null),
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('blocked');
      });

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetRef.current && window.turnstile) {
      window.turnstile.reset(widgetRef.current);
      tokenCallback.current(null);
    }
  }, [resetSignal]);

  // The widget is 300px wide. On very narrow screens, shrink it to fit instead of overflowing.
  useEffect(() => {
    const wrapper = holderRef.current?.parentElement;
    if (!wrapper || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setScale(Math.min(1, wrapper.clientWidth / WIDGET_WIDTH)));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  if (status === 'blocked') {
    return (
      <div role="alert" className="border-l-[3px] border-pen bg-pen/[0.07] py-2 pl-3 pr-2 text-[13.5px] leading-snug text-pen">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldAlert size={16} strokeWidth={1.8} aria-hidden />
          The security check couldn&apos;t load
        </p>
        <p className="mt-1 text-ink/75">
          Something is blocking Cloudflare (an ad or content blocker, a VPN or your network). Allow{' '}
          <span className="font-semibold">challenges.cloudflare.com</span>, then{' '}
          <button type="button" onClick={() => window.location.reload()} className="font-semibold text-ink underline underline-offset-2">
            reload the page
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden" style={{ height: WIDGET_HEIGHT * scale }}>
      {status === 'loading' && (
        <p className="flex h-[65px] items-center gap-2.5 text-[13px] text-ink/60">
          <Spinner /> Loading the security check…
        </p>
      )}
      <div ref={holderRef} style={{ width: WIDGET_WIDTH, transform: `scale(${scale})`, transformOrigin: '0 0' }} />
    </div>
  );
}
