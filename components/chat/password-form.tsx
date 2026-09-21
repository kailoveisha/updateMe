'use client';

import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { AuthError } from '@supabase/supabase-js';
import { Spinner } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

const MIN_LENGTH = 8;

function describe(error: AuthError): string {
  const code = String(error.code ?? '');
  if (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message)) {
    return "Can't reach Updateme right now. Check your connection and try again.";
  }
  if (code === 'same_password') return "That's already your password. Choose a different one.";
  if (code === 'weak_password') return error.message || 'That password is too easy to guess. Try a longer one.';
  if (code === 'over_request_rate_limit' || error.status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (code === 'reauthentication_needed') return 'For your safety, sign out and sign back in, then change your password.';
  return "Couldn't change the password. Try again in a moment.";
}

export function PasswordForm({ email }: { email: string | null }) {
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setDone(false);
    setError(null);

    if (!current) return setError('Enter your current password.');
    if (next.length < MIN_LENGTH) return setError(`Your new password needs at least ${MIN_LENGTH} characters.`);
    if (next === current) return setError('Your new password must be different from the current one.');
    if (next !== confirm) return setError("The two new passwords don't match.");
    if (!email) return setError("Couldn't find your account email. Sign out and back in, then try again.");

    setPending(true);
    try {
      const supabase = getBrowserClient();

      // Prove it's really you (someone could be borrowing your open screen).
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) {
        setError(
          check.error.code === 'invalid_credentials' || /invalid login/i.test(check.error.message)
            ? "Your current password isn't right."
            : describe(check.error),
        );
        return;
      }

      const update = await supabase.auth.updateUser({ password: next });
      if (update.error) {
        setError(describe(update.error));
        return;
      }

      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch {
      setError("Can't reach Updateme right now. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink/65">
        {label}
      </label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setDone(false);
        }}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={pending}
        className="ruled-input"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-5">
        {field(currentId, 'Current password', current, setCurrent, 'current-password')}
        {field(nextId, `New password (at least ${MIN_LENGTH} characters)`, next, setNext, 'new-password')}
        {field(confirmId, 'New password, once more', confirm, setConfirm, 'new-password')}
      </div>

      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-pressed={show}
        className="mt-3 inline-flex items-center gap-2 py-1 text-[13px] text-ink/65 hover:text-ink"
      >
        {show ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
        {show ? 'Hide passwords' : 'Show passwords'}
      </button>

      <div className="mt-2 min-h-[2.5rem]" aria-live="polite">
        {error && (
          <p role="alert" className="animate-fade-in border-l-[3px] border-pen bg-pen/[0.07] py-1.5 pl-3 pr-2 text-[13.5px] leading-snug text-pen">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="animate-fade-in border-l-[3px] border-moss bg-moss/[0.12] py-1.5 pl-3 pr-2 text-[13.5px] leading-snug">
            Password changed. Use the new one next time you sign in.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2.5 bg-ink px-5 text-[14.5px] font-semibold text-paper-hi transition hover:bg-ink/90 active:translate-y-px disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Spinner /> Changing…
          </>
        ) : (
          'Change password'
        )}
      </button>
    </form>
  );
}
