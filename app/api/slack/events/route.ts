import { NextResponse, after } from 'next/server';
import { runAgent } from '@/lib/ai/agent';
import { getCalendarEventsToday } from '@/lib/google/calendar';
import { listRecentGmailMessages } from '@/lib/google/gmail';
import { verifySlackRequest, postSlackMessage } from '@/lib/slack/client';

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-slack-signature') ?? '';
    const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
    const retryNum = req.headers.get('x-slack-retry-num');

    console.log('[slack/events] request received', {
      requestId,
      hasSignature: Boolean(signature),
      hasTimestamp: Boolean(timestamp),
      retryNum: retryNum ?? null,
      contentLength: rawBody.length,
    });

    if (retryNum) {
      console.log('[slack/events] retry ignored', { requestId, retryNum });
      return NextResponse.json({ ok: true });
    }

    const isValid = verifySlackRequest({
      rawBody,
      signature,
      timestamp,
    });

    if (!isValid) {
      console.error('[slack/events] invalid signature', {
        requestId,
        timestamp,
      });
      return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    console.log('[slack/events] body parsed', {
      requestId,
      outerType: body?.type ?? null,
      innerType: body?.event?.type ?? null,
      eventId: body?.event_id ?? null,
      teamId: body?.team_id ?? null,
      apiAppId: body?.api_app_id ?? null,
    });

    if (body.type === 'url_verification') {
      console.log('[slack/events] url_verification', {
        requestId,
        challengeExists: Boolean(body.challenge),
      });
      return NextResponse.json({ challenge: body.challenge });
    }

    if (body.type !== 'event_callback') {
      console.log('[slack/events] ignored non-event_callback', {
        requestId,
        outerType: body?.type ?? null,
      });
      return NextResponse.json({ ok: true });
    }

    const event = body.event;

    if (event.type !== 'app_mention' || event.bot_id) {
      console.log('[slack/events] ignored event', {
        requestId,
        innerType: event?.type ?? null,
        botId: event?.bot_id ?? null,
        subtype: event?.subtype ?? null,
      });
      return NextResponse.json({ ok: true });
    }

    const slackUserId = event.user as string;
    const channel = event.channel as string;
    const threadTs = event.thread_ts ?? event.ts;
    const prompt = String(event.text ?? '').replace(/<@[^>]+>/g, '').trim();

    console.log('[slack/events] app_mention accepted', {
      requestId,
      slackUserId,
      channel,
      threadTs,
      promptPreview: prompt.slice(0, 120),
      elapsedMs: Date.now() - startedAt,
    });

    after(async () => {
      const bgStartedAt = Date.now();

      try {
        console.log('[slack/events] background start', {
          requestId,
          slackUserId,
          channel,
          threadTs,
        });

        console.log('[slack/events] fetching google context start', { requestId });

        const [todayEvents, recentMessages] = await Promise.all([
          getCalendarEventsToday(slackUserId),
          listRecentGmailMessages(slackUserId, 5),
        ]);

        console.log('[slack/events] fetching google context done', {
          requestId,
          todayEventsCount: Array.isArray(todayEvents) ? todayEvents.length : null,
          recentMessagesCount: Array.isArray(recentMessages) ? recentMessages.length : null,
          elapsedMs: Date.now() - bgStartedAt,
        });

        console.log('[slack/events] runAgent start', {
          requestId,
          promptPreview: (prompt || '今日のメールと予定を手短に整理して').slice(0, 120),
        });

        const reply = await runAgent({
          slackUserId,
          prompt: prompt || '今日のメールと予定を手短に整理して',
          context: {
            todayEvents,
            recentMessages,
          },
        });

        console.log('[slack/events] runAgent done', {
          requestId,
          replyTextLength: reply?.text?.length ?? 0,
          elapsedMs: Date.now() - bgStartedAt,
        });

        console.log('[slack/events] postSlackMessage start', {
          requestId,
          channel,
          threadTs,
        });

        await postSlackMessage({
          channel,
          text: reply.text,
          thread_ts: threadTs,
        });

        console.log('[slack/events] postSlackMessage done', {
          requestId,
          elapsedMs: Date.now() - bgStartedAt,
        });
      } catch (error: any) {
        console.error('[slack/events] background error', {
          requestId,
          message: error?.message ?? String(error),
          stack: error?.stack ?? null,
          data: error?.data ?? null,
          elapsedMs: Date.now() - bgStartedAt,
        });

        try {
          console.log('[slack/events] fallback postSlackMessage start', { requestId });

          await postSlackMessage({
            channel,
            text: '処理中にエラーが発生しました。Google 接続や権限設定を確認してください。',
            thread_ts: threadTs,
          });

          console.log('[slack/events] fallback postSlackMessage done', { requestId });
        } catch (postError: any) {
          console.error('[slack/events] fallback post failed', {
            requestId,
            message: postError?.message ?? String(postError),
            stack: postError?.stack ?? null,
            data: postError?.data ?? null,
          });
        }
      }
    });

    console.log('[slack/events] ack response', {
      requestId,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[slack/events] fatal', {
      requestId,
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true });
  }
}