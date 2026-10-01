import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerSupabase } from '@/lib/supabase/server';

const MESSAGE_FIELDS = 'id, sender_id, body, created_at';

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: 'Email notifications are not configured.' }, { status: 503 });

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messageId } = (await request.json()) as { messageId?: string };
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: 'Invalid message id.' }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .eq('id', messageId)
    .eq('sender_id', user.id)
    .is('deleted_at', null)
    .single();
  if (messageError || !message) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });

  const { data: sender, error: senderError } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .single();
  if (senderError || !sender) return NextResponse.json({ error: 'Sender not found.' }, { status: 404 });

  const recipient = sender.username === 'isha' ? process.env.ISHA_NOTIFICATION_EMAIL : sender.username === 'kai' ? process.env.KAI_NOTIFICATION_EMAIL : undefined;
  if (!recipient) return NextResponse.json({ error: 'Recipient is not configured.' }, { status: 503 });

  const resend = new Resend(apiKey);
  const preview = message.body?.trim() || 'Sent an attachment';
  const { data, error } = await resend.emails.send(
    {
      from,
      to: [recipient],
      subject: `${sender.display_name || sender.username} sent you a message`,
      text: `${sender.display_name || sender.username} sent you a message:\n\n${preview}`,
      html: `<p><strong>${escapeHtml(sender.display_name || sender.username)}</strong> sent you a message:</p><p>${escapeHtml(preview).replace(/\n/g, '<br />')}</p>`,
    },
    { idempotencyKey: `message-notification/${message.id}` },
  );

  if (error) {
    console.error('[v0] Resend notification failed:', error.message);
    return NextResponse.json({ error: 'Unable to send notification.' }, { status: 502 });
  }
  return NextResponse.json({ id: data?.id });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}
