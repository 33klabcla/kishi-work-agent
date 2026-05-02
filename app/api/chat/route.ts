import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getGoogleConnectionForSlackUser } from '@/lib/google/store';
import { getCalendarEventsToday } from '@/lib/google/calendar';
import { listRecentGmailMessages } from '@/lib/google/gmail';
import { runAgent } from '@/lib/ai/agent';
import { writeAuditLog } from '@/lib/security/audit';

const bodySchema = z.object({
  slackUserId: z.string().min(1),
  prompt: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { slackUserId: body.slackUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Slack user is not connected yet.' },
        { status: 404 },
      );
    }

    const connection = await getGoogleConnectionForSlackUser(body.slackUserId);

    if (!connection) {
      return NextResponse.json(
        { error: 'Google connection not found.' },
        { status: 404 },
      );
    }

    const [events, messages] = await Promise.all([
      getCalendarEventsToday(body.slackUserId),
      listRecentGmailMessages(body.slackUserId, 5),
    ]);

    const result = await runAgent({
      prompt: body.prompt,
      slackUserId: body.slackUserId,
      context: {
        todayEvents: events,
        recentMessages: messages,
      },
    });

    await writeAuditLog({
      userId: user.id,
      actor: `slack:${body.slackUserId}`,
      eventType: 'agent.chat.completed',
      metadata: {
        prompt: body.prompt,
        eventCount: events.length,
        messageCount: messages.length,
      },
    });

    return NextResponse.json({
      ok: true,
      text: result.text,
      todayEvents: events,
      recentMessages: messages,
    });
  } catch (error) {
    console.error('/api/chat error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown /api/chat error',
      },
      { status: 500 },
    );
  }
}