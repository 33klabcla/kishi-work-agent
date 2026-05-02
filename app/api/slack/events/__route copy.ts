/*import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/ai/agent';
import { getCalendarEventsToday } from '@/lib/google/calendar';
import { listRecentGmailMessages } from '@/lib/google/gmail';
import { verifySlackRequest, postSlackMessage } from '@/lib/slack/client';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-slack-signature') ?? '';
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';

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

  if (event.type !== 'app_mention') {
    return NextResponse.json({ ok: true });
  }

  const slackUserId = event.user as string;
  const channel = event.channel as string;
  const prompt = String(event.text ?? '').replace(/<@[^>]+>/g, '').trim();

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
      thread_ts: event.ts,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('/api/slack/events error:', error);

    await postSlackMessage({
      channel,
      text: 'エージェント処理中にエラーが発生しました。接続設定または権限を確認してください。',
      thread_ts: event.ts,
    }).catch(() => {});

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}*/