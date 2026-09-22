import type { Profile } from '@/types/chat';

export type Accent = 'kai' | 'isha' | 'ink';

/** Each person keeps the same colour on both screens: Kai is teal ink, Isha is pink ink. */
export function accentOf(person: Pick<Profile, 'username'> | null | undefined): Accent {
  if (person?.username === 'kai') return 'kai';
  if (person?.username === 'isha') return 'isha';
  return 'ink';
}

// Class names are written out in full so Tailwind can see them.
export const accentClass: Record<Accent, { text: string; slip: string; rule: string }> = {
  kai: { text: 'text-kai', slip: 'bg-kai/[0.075]', rule: 'border-l-kai' },
  isha: { text: 'text-isha', slip: 'bg-isha/[0.075]', rule: 'border-l-isha' },
  ink: { text: 'text-ink', slip: 'bg-paper-hi', rule: 'border-l-ink' },
};

export function initialOf(person: Pick<Profile, 'display_name'> | null | undefined): string {
  return (person?.display_name ?? '?').trim().charAt(0).toUpperCase() || '?';
}
