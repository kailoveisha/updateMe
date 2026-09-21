'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { AuthError } from '@supabase/supabase-js';
import { LOGIN_EMAIL_DOMAIN } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/spinner';

function describeAuthError(error: AuthError): string {
  const code = (error.code ?? '').toString();
  if (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message)) {
    return "Can't reach Updateme right now. Check your connection and try again.";
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return "That name and password don't match. Check them and try again.";
  }
  if (code === 'email_not_confirmed') {
    return "This account isn't confirmed yet. In Supabase, open Authentication → Users and confirm it.";
  }
  if (code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many attempts. Wait a minute, then try again.';
  }
  if (error.status && error.status >= 500) {
    return 'Supabase is having trouble right now. Try again in a moment.';
  }
  return "Couldn't sign you in. Try again in a moment.";
}

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const nameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  function fail(message: string) {
    setError(message);
    setShake((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const name = username.trim().toLowerCase();
    if (!name) return fail('Enter your name.');
    if (!password) return fail('Enter your password.');
    if (!configured) return fail("This site isn't connected to Supabase yet. See the README.");

    setPending(true);
    setError(null);

    // "kai" → kai@updateme.local. A full email address works too.
    const email = name.includes('@') ? name : `${name}@${LOGIN_EMAIL_DOMAIN}`;

    try {
      const { error: authError } = await getBrowserClient().auth.signInWithPassword({ email, password });
      if (authError) {
        fail(describeAuthError(authError));
        setPending(false);
        return;
      }
      router.replace('/chat');
      router.refresh();
    } catch {
      fail("Can't reach Updateme right now. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-describedby={error ? errorId : undefined}>
      <div className="space-y-6">
        <div>
          <label htmlFor={nameId} className="block text-[13px] font-medium text-ink/65">
            Name
          </label>
          <input
            id={nameId}
            name="username"
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            className="ruled-input"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="block text-[13px] font-medium text-ink/65">
            Password
          </label>
          <div className="relative">
            <input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              className="ruled-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-ink/55 transition-colors hover:text-ink"
            >
              {showPassword ? <EyeOff size={17} strokeWidth={1.6} /> : <Eye size={17} strokeWidth={1.6} />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-[2.25rem]" aria-live="polite">
        {error && (
          <p
            key={shake}
            id={errorId}
            role="alert"
            className="animate-shake border-l-[3px] border-pen bg-pen/[0.07] py-1.5 pl-3 pr-2 text-[13.5px] leading-snug text-pen"
          >
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2.5 rounded-[2px] bg-ink px-5 text-[15px] font-semibold text-paper-hi shadow-[0_2px_0_rgb(var(--shade)/0.25)] transition duration-150 hover:bg-ink/90 active:translate-y-px active:shadow-none disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Spinner />
            <span>Opening…</span>
          </>
        ) : (
          <span>Come in</span>
        )}
      </button>
    </form>
  );
}
