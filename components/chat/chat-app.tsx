'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { ChatHeader } from '@/components/chat/chat-header';
import { Composer } from '@/components/chat/composer';
import { ConnectionBanner } from '@/components/chat/connection-banner';
import { ImageLightbox } from '@/components/chat/image-lightbox';
import { MessageList } from '@/components/chat/message-list';
import type { OpenImage } from '@/components/chat/message-item';
import { SidebarContent } from '@/components/chat/sidebar';
import { useAttachment } from '@/hooks/use-attachment';
import { useChat } from '@/hooks/use-chat';
import { useIsClient } from '@/hooks/use-is-client';
import { usePresence } from '@/hooks/use-presence';
import { getBrowserClient } from '@/lib/supabase/client';
import type { ChatBootstrap, Profile } from '@/types/chat';

type Ready = Extract<ChatBootstrap, { status: 'ready' }>;

export function ChatScreen({ bootstrap }: { bootstrap: Ready }) {
  const router = useRouter();
  const mounted = useIsClient();
  const { me, people } = bootstrap;
  const other: Profile | null = useMemo(() => people.find((p) => p.id !== me.id) ?? null, [people, me.id]);

  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<OpenImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const goToLogin = useCallback(
    (reason?: 'expired') => {
      router.replace(reason ? `/login?reason=${reason}` : '/login');
      router.refresh();
    },
    [router],
  );

  const chat = useChat({
    myId: me.id,
    initial: { messages: bootstrap.messages, hasMore: bootstrap.hasMore, stats: bootstrap.stats },
    onSessionExpired: () => {
      if (!signingOutRef.current) goToLogin('expired');
    },
  });
  const presence = usePresence(me.id);
  const attachment = useAttachment();

  // If the session ends anywhere (another tab, expiry), leave the chat instead of failing silently.
  useEffect(() => {
    const { data } = getBrowserClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !signingOutRef.current) goToLogin('expired');
    });
    return () => data.subscription.unsubscribe();
  }, [goToLogin]);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      // "local" ends this browser's session only. Nothing in the conversation is touched.
      await getBrowserClient().auth.signOut({ scope: 'local' });
    } catch {
      /* even if the request fails, the local session is cleared */
    }
    goToLogin();
  }, [goToLogin]);

  const handleSend = useCallback(
    (body: string) => {
      const image = attachment.take();
      chat.send({ body, image });
    },
    [attachment, chat],
  );

  /* ----- drag & drop an image anywhere on the conversation ----- */
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const onDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault();
  };
  const onDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (event.dataTransfer.files.length > 0) void attachment.attach(event.dataTransfer.files);
  };

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const sidebar = (onClose?: () => void) => (
    <SidebarContent
      people={people}
      meId={me.id}
      onlineIds={presence.onlineIds}
      presenceKnown={presence.available}
      stats={chat.stats}
      signingOut={signingOut}
      onSignOut={signOut}
      onClose={onClose}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-[18.5rem] shrink-0 lg:block xl:w-[20rem]">{sidebar()}</aside>

      <main
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <ChatHeader
          other={other}
          online={other ? presence.onlineIds.has(other.id) : false}
          presenceKnown={presence.available}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <ConnectionBanner state={chat.connection} />

        {mounted ? (
          <MessageList
            messages={chat.items}
            meId={me.id}
            people={people}
            otherName={other?.display_name ?? null}
            hasMore={chat.hasMore}
            loadingEarlier={chat.loadingEarlier}
            loadError={chat.loadError}
            onLoadEarlier={chat.loadEarlier}
            onRetry={chat.retry}
            onDiscard={chat.discard}
            onOpenImage={setLightbox}
          />
        ) : (
          <div className="paper-ruled min-h-0 flex-1" aria-busy="true" />
        )}

        <Composer
          otherName={other?.display_name ?? null}
          attachment={attachment.attachment}
          preparing={attachment.preparing}
          notice={attachment.notice}
          onAttach={(files) => void attachment.attach(files)}
          onClearAttachment={attachment.clear}
          onDismissNotice={attachment.dismissNotice}
          onSend={handleSend}
        />

        {dragging && (
          <div className="animate-fade-in pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-ink bg-marker/45 text-center">
            <ImagePlus size={34} strokeWidth={1.4} />
            <p className="font-display text-[1.9rem] font-medium leading-none">Drop it to attach</p>
          </div>
        )}
      </main>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close details"
            onClick={closeMenu}
            className="animate-fade-in absolute inset-0 bg-ink/50"
          />
          <div className="animate-drawer-in absolute inset-y-0 left-0 w-[min(21rem,88vw)] shadow-sheet">
            {sidebar(closeMenu)}
          </div>
        </div>
      )}

      {lightbox && <ImageLightbox image={lightbox} onClose={closeLightbox} />}
    </div>
  );
}
