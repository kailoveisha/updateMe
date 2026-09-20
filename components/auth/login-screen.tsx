import { CropMarks } from '@/components/ui/crop-marks';
import { DateStamp } from '@/components/ui/date-stamp';
import { Tape } from '@/components/ui/tape';
import { LoginForm } from './login-form';

interface Props {
  configured: boolean;
  reason?: string;
}

const WORD = 'Updateme'.split('');

export function LoginScreen({ configured, reason }: Props) {
  return (
    <main className="paper-grid relative flex min-h-dvh flex-col overflow-hidden">
      <CropMarks />

      <div className="relative z-10 mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 content-start gap-8 px-8 pb-6 pt-12 sm:px-14 lg:-mb-16 lg:grid-cols-12 lg:gap-6 lg:pt-16">
        <section className="lg:col-span-5">
          <p className="max-w-[15ch] font-display text-[2.35rem] font-medium leading-[1.06] tracking-[-0.01em] text-balance sm:text-[2.9rem] lg:text-[3.3rem]">
            A small private page for two.
          </p>
          <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-ink/70">
            Sign in and pick up the conversation where you left it. Everything stays here, in order, until you come
            back.
          </p>
          <div className="mt-5 flex items-end gap-12 sm:mt-7">
            <p aria-hidden className="-rotate-[4deg] font-hand text-[2.1rem] leading-none text-ink/75">
              just us.
              <svg viewBox="0 0 90 10" className="mt-1 h-2.5 w-[5.5rem] text-marker" fill="none">
                <path d="M2 6c10-6 14 4 24-1s14 3 24-2 14 4 24-1 12 1 14-1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </p>
            <DateStamp className="hidden text-ink sm:inline-block" />
          </div>
        </section>

        <section className="lg:col-span-4 lg:col-start-8 lg:pt-6">
          <div className="animate-settle-in relative -rotate-[1.1deg] border border-ink/70 bg-paper-hi px-6 pb-7 pt-9 shadow-slip [animation-delay:650ms] sm:px-8">
            <Tape className="-top-2.5 left-9 -rotate-[5deg]" />
            <h2 className="font-display text-[1.7rem] font-medium leading-none">Sign in</h2>

            {reason === 'expired' && (
              <p className="mt-4 border-l-[3px] border-marker bg-marker/20 py-1.5 pl-3 pr-2 text-[13.5px] leading-snug">
                Your session ended. Sign in again to keep going.
              </p>
            )}
            {!configured && (
              <p className="mt-4 border-l-[3px] border-pen bg-pen/[0.07] py-1.5 pl-3 pr-2 text-[13.5px] leading-snug text-pen">
                Supabase isn&apos;t connected yet. Add <code className="font-semibold">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
                and <code className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then restart. The README has
                the steps.
              </p>
            )}

            <div className="mt-6">
              <LoginForm configured={configured} />
            </div>

            <p className="mt-5 text-[12.5px] leading-snug text-ink/55">
              Accounts are set up by the owner. There is no sign-up.
            </p>
          </div>
        </section>
      </div>

      <h1
        aria-label="Updateme"
        className="relative z-0 mb-[0.1em] ml-[-0.035em] mt-2 lg:-mt-4 lg:mb-[-0.07em] select-none whitespace-nowrap px-0 font-display font-medium leading-[0.8] tracking-[-0.05em] text-ink"
        style={{ fontSize: 'min(22.4vw, 27rem)', fontVariationSettings: '"opsz" 36' }}
      >
        {WORD.map((letter, i) => (
          <span
            key={i}
            aria-hidden
            className="-mx-[0.02em] -mb-[0.3em] -mt-[0.16em] inline-block overflow-hidden px-[0.02em] pb-[0.3em] pt-[0.16em] align-bottom"
          >
            <span className="inline-block animate-rise-in" style={{ animationDelay: `${120 + i * 70}ms` }}>
              {letter}
            </span>
          </span>
        ))}
      </h1>
    </main>
  );
}
