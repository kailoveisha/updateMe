'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { ChatHeader } from '@/components/chat/chat-header';
import { Composer } from '@/components/chat/composer';
import { ConnectionBanner } from '@/components/chat/connection-banner';
import { DeleteDialog } from '@/components/chat/delete-dialog';
import { ImageLightbox } from '@/components/chat/image-lightbox';
import { MessageList } from '@/components/chat/message-list';
import { SearchPanel } from '@/components/chat/search-panel';
import { SettingsDialog } from '@/components/chat/settings-dialog';
import { SidebarContent } from '@/components/chat/sidebar';
import { useAppearance } from '@/hooks/use-appearance';
import { useAttachment } from '@/hooks/use-attachment';
import { useChat } from '@/hooks/use-chat';
import { useIsClient } from '@/hooks/use-is-client';
import { usePresence } from '@/hooks/use-presence';
import type { PreparedVoice } from '@/lib/chat/voice';
import { getBrowserClient } from '@/lib/supabase/client';
import type { ChatBootstrap, ChatMessage, MessageRow, Profile } from '@/types/chat';

type Ready = Extract<ChatBootstrap, { status: 'ready' }>;

export function ChatScreen({ bootstrap }: { bootstrap: Ready }) {
  const router = useRouter();
  const mounted = useIsClient();
  const { me, people } = bootstrap;
  const other: Profile | null = useMemo(() => people.find((p) => p.id !== me.id) ?? null, [people, me.id]);

  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [jumpTarget, setJumpTarget] = useState<{ id: string; nonce: number } | null>(null);
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
  const appearance = useAppearance(me.id, me.preferences);

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

  const { take: takeAttachment, setNotice } = attachment;
  const { send: sendMessage, loadUntil } = chat;

  const handleSend = useCallback(
    (body: string, voice: PreparedVoice | null) => {
      // A voice note is sent on its own; any picked photo stays in the composer for later.
      sendMessage({ body, image: voice ? null : takeAttachment(), voice });
    },
    [sendMessage, takeAttachment],
  );

  /* ----- search: open a result, even one far back in history ----- */
  const handleJump = useCallback(
    async (row: MessageRow) => {
      setSearchOpen(false);
      const ok = await loadUntil(row.created_at);
      if (ok) setJumpTarget({ id: row.id, nonce: Date.now() });
      else setNotice("Couldn't load that part of the conversation. Check your connection and try again.");
    },
    [loadUntil, setNotice],
  );
  const clearJump = useCallback(() => setJumpTarget(null), []);

  /* ----- delete for me / unsend for everyone ----- */
  const { unsend, hideForMe } = chat;
  const closeDelete = useCallback(() => setDeleting(null), []);
  const requestDelete = useCallback((message: ChatMessage) => setDeleting(message), []);
  const runDelete = useCallback(
    async (kind: 'me' | 'everyone'): Promise<string | null> => {
      if (!deleting) return null;
      const result = await (kind === 'me' ? hideForMe(deleting.id) : unsend(deleting.id));
      if (result.ok) {
        setDeleting(null);
        return null;
      }
      return result.message;
    },
    [deleting, hideForMe, unsend],
  );

  /* ----- photos for the full-screen viewer ----- */
  const photos = useMemo(() => chat.items.filter((m) => m.image_path), [chat.items]);

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

  const closeLightbox = useCallback(() => setLightboxId(null), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openSettings = useCallback(() => {
    setMenuOpen(false);
    setSettingsOpen(true);
  }, []);

  const otherActivity = other ? (presence.activity[other.id] ?? null) : null;

  const sidebar = (onClose?: () => void) => (
    <SidebarContent
      people={people}
      meId={me.id}
      onlineIds={presence.onlineIds}
      presenceKnown={presence.available}
      stats={chat.stats}
      signingOut={signingOut}
      onSignOut={signOut}
      onOpenSettings={openSettings}
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
          activity={otherActivity}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <ConnectionBanner state={chat.connection} />

        {/* The search panel covers the conversation and the composer, but not the header. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
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
              onOpenImage={setLightboxId}
              onRequestDelete={requestDelete}
              otherActivity={otherActivity}
              jumpTarget={jumpTarget}
              onJumpHandled={clearJump}
            />
          ) : (
            <div className="paper-sheet min-h-0 flex-1" aria-busy="true" />
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
            onActivity={presence.setActivity}
          />

          {searchOpen && <SearchPanel people={people} onJump={handleJump} onClose={closeSearch} />}
        </div>

        {dragging && (
          <div className="animate-fade-in pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-ink bg-marker/45 text-center">
            <ImagePlus size={34} strokeWidth={1.4} />
            <p className="font-display text-[1.9rem] font-medium leading-none">Drop it to attach</p>
          </div>
        )}
      </main>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={closeMenu} className="animate-fade-in absolute inset-0 bg-scrim/50" />
          <div className="animate-drawer-in absolute inset-y-0 left-0 w-[min(21rem,88vw)] shadow-sheet">{sidebar(closeMenu)}</div>
        </div>
      )}

      {settingsOpen && (
        <SettingsDialog
          name={me.display_name}
          email={bootstrap.email}
          look={appearance.look}
          saveState={appearance.saveState}
          onLookChange={appearance.setLook}
          onClose={closeSettings}
        />
      )}

      {deleting && (
        <DeleteDialog
          message={deleting}
          mine={deleting.sender_id === me.id}
          otherName={other?.display_name ?? null}
          onForMe={() => runDelete('me')}
          onForEveryone={() => runDelete('everyone')}
          onClose={closeDelete}
        />
      )}

      {lightboxId && <ImageLightbox images={photos} startId={lightboxId} onClose={closeLightbox} />}
    </div>
  );
}
