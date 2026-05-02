/*import { z } from 'zod';
import { tool } from 'ai';
import { getGoogleClientForSlackUser, gmail, calendar } from '@/lib/google/tokens';
import { writeAuditLog } from '@/lib/security/audit';

function decodeBody(data?: string | null) {
  if (!data) return '';
  return Buffer.from(data, 'base64').toString('utf8');
}

export function buildGoogleTools(slackUserId: string) {
  return {
    searchGmail: tool({
      description: 'Search Gmail messages for the connected user. Use narrow queries and recent windows.',
      inputSchema: z.object({
        query: z.string().min(1),
        maxResults: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, maxResults }) => {
        const { client, user } = await getGoogleClientForSlackUser(slackUserId);
        const api = gmail(client);
        const result = await api.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
        });

        const messages = result.data.messages ?? [];

        await writeAuditLog({
          userId: user.id,
          actor: 'agent',
          eventType: 'gmail.search',
          metadata: { query, maxResults, count: messages.length },
        });

        return { count: messages.length, messages };
      },
    }),

    getCalendarToday: tool({
      description: 'Get calendar events for today for the connected user.',
      inputSchema: z.object({
        timezone: z.string().default('Asia/Tokyo'),
      }),
      execute: async ({ timezone }) => {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        const { client, user } = await getGoogleClientForSlackUser(slackUserId);
        const api = calendar(client);

        const result = await api.events.list({
          calendarId: 'primary',
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          timeZone: timezone,
        });

        await writeAuditLog({
          userId: user.id,
          actor: 'agent',
          eventType: 'calendar.read',
          metadata: { timezone, count: result.data.items?.length ?? 0 },
        });

        return { items: result.data.items ?? [] };
      },
    }),

    createGmailDraft: tool({
      description: 'Create a Gmail draft for the connected user. Never send directly.',
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        bodyText: z.string().min(1),
      }),
      execute: async ({ to, subject, bodyText }) => {
        const { client, user } = await getGoogleClientForSlackUser(slackUserId);
        const api = gmail(client);

        const raw = Buffer.from(
          [
            `To: ${to}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${subject}`,
            '',
            bodyText,
          ].join('\n'),
        ).toString('base64url');

        const draft = await api.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: { raw },
          },
        });

        await writeAuditLog({
          userId: user.id,
          actor: 'agent',
          eventType: 'gmail.draft.create',
          metadata: { to, subject, draftId: draft.data.id },
        });

        return { draftId: draft.data.id, to, subject };
      },
    }),

    getGmailMessage: tool({
      description: 'Read a Gmail message by id for the connected user.',
      inputSchema: z.object({
        messageId: z.string().min(1),
      }),
      execute: async ({ messageId }) => {
        const { client, user } = await getGoogleClientForSlackUser(slackUserId);
        const api = gmail(client);

        const result = await api.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const headers = result.data.payload?.headers ?? [];
        const headerMap = Object.fromEntries(
          headers.map(h => [h.name?.toLowerCase() ?? '', h.value ?? '']),
        );

        const parts = result.data.payload?.parts ?? [];
        const bodyPart = parts.find(p => p.mimeType === 'text/plain') ?? result.data.payload;
        const text = decodeBody(bodyPart?.body?.data);

        await writeAuditLog({
          userId: user.id,
          actor: 'agent',
          eventType: 'gmail.message.read',
          metadata: { messageId },
        });

        return {
          id: result.data.id,
          threadId: result.data.threadId,
          subject: headerMap.subject ?? '',
          from: headerMap.from ?? '',
          date: headerMap.date ?? '',
          snippet: result.data.snippet ?? '',
          text,
        };
      },
    }),
  };
}*/
// Google tools for AI SDK を使う場合の実装をここに置く予定。
// 現状のエージェントは手動で Gmail/Calendar を呼んでいるので、このファイルは未使用です。
export {};