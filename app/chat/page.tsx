import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ChatScreen } from '@/components/chat/chat-app';
import { ChatLoadError, NotParticipant } from '@/components/chat/chat-states';
import { isSupabaseConfigured } from '@/lib/env';
import { describeError } from '@/lib/chat/errors';
import { fetchPage, fetchProfiles, fetchStats } from '@/lib/chat/queries';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ChatBootstrap, ChatStats } from '@/types/chat';

export const metadata: Metadata = { title: 'Chat' };
export const dynamic = 'force-dynamic';

type Loaded = { kind: 'signed-out' } | { kind: 'bootstrap'; value: ChatBootstrap };

async function load(): Promise<Loaded> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();

    if (!data.user) {
      const unreachable = error && (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message));
      return unreachable
        ? { kind: 'bootstrap', value: { status: 'error', message: "Can't reach Supabase right now. Check your connection and try again." } }
        : { kind: 'signed-out' };
    }

    const people = await fetchProfiles(supabase);
    const me = people.find((p) => p.id === data.user.id);
    if (!me) return { kind: 'bootstrap', value: { status: 'not-participant', email: data.user.email ?? null } };

    const page = await fetchPage(supabase);
    let stats: ChatStats;
    try {
      stats = await fetchStats(supabase);
    } catch {
      // The numbers in the side panel are a nicety; never block the chat on them.
      stats = {
        total: page.rows.length,
        photos: page.rows.filter((m) => m.image_path).length,
        firstAt: page.rows[0]?.created_at ?? null,
      };
    }

    return { kind: 'bootstrap', value: { status: 'ready', me, email: data.user.email ?? null, people, messages: page.rows, hasMore: page.hasMore, stats } };
  } catch (error) {
    return { kind: 'bootstrap', value: { status: 'error', message: describeError(error).message } };
  }
}

export default async function ChatPage() {
  if (!isSupabaseConfigured()) redirect('/login');

  const loaded = await load();
  if (loaded.kind === 'signed-out') redirect('/login');

  const bootstrap = loaded.value;
  if (bootstrap.status === 'ready') return <ChatScreen bootstrap={bootstrap} />;
  if (bootstrap.status === 'not-participant') return <NotParticipant email={bootstrap.email} />;
  return <ChatLoadError message={bootstrap.message} />;
}
