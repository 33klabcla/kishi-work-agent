import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/ai/agent';
import { getCalendarEventsToday } from '@/lib/google/calendar';
import { listRecentGmailMessages } from '@/lib/google/gmail';
import { verifySlackRequest, postSlackMessage } from '@/lib/slack/client';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-slack-signature') ?? '';
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const retryNum = req.headers.get('x-slack-retry-num');

  if (retryNum) {
    return NextResponse.json({ ok: true });
  }

  const isValid = verifySlackRequest({
    rawBody,
    signature,
    timestamp,
  });

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== 'event_callback') {
    return NextResponse.json({ ok: true });
  }

  const event = body.event;

  if (event.type !== 'app_mention' || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  const slackUserId = event.user as string;
  const channel = event.channel as string;
  const threadTs = event.thread_ts ?? event.ts;
  const prompt = String(event.text ?? '').replace(/<@[^>]+>/g, '').trim();

  setTimeout(async () => {
    try {
      const [todayEvents, recentMessages] = await Promise.all([
        getCalendarEventsToday(slackUserId),
        listRecentGmailMessages(slackUserId, 5),
      ]);

      const reply = await runAgent({
        slackUserId,
        prompt: prompt || '今日のメールと予定を手短に整理して',
        context: {
          todayEvents,
          recentMessages,
        },
      });

      await postSlackMessage({
        channel,
        text: reply.text,
        thread_ts: threadTs,
      });
    } catch (error) {
      console.error('/api/slack/events async error:', error);

      await postSlackMessage({
        channel,
        text: '処理中にエラーが発生しました。Google 接続や権限設定を確認してください。',
        thread_ts: threadTs,
      }).catch(() => {});
    }
  }, 0);

  return NextResponse.json({ ok: true });
}