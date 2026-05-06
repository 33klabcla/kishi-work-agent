import { google, gmail_v1 } from 'googleapis';
import { getGoogleConnectionForSlackUser, buildGoogleAuthClientFromConnection } from './store';

export type SimpleGmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  subject?: string;
  date?: string;
  body?: string; // ← 追加：本文テキスト（最大 1500 字）
};

function extractHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined,
  name: string,
) {
  const found = headers?.find(
    (h) => (h.name ?? '').toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? undefined;
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  // multipart の場合は再帰で text/plain を探す
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  if (
    payload.mimeType === 'text/plain' &&
    payload.body?.data
  ) {
    return Buffer.from(payload.body.data, 'base64url')
      .toString('utf-8')
      .slice(0, 1500); // 長すぎる本文は 1500 字で切る
  }

  return '';
}

export async function listRecentGmailMessages(
  slackUserId: string,
  maxResults = 5,
): Promise<SimpleGmailMessage[]> {
  const conn = await getGoogleConnectionForSlackUser(slackUserId);
  if (!conn) return [];

  const auth = buildGoogleAuthClientFromConnection(conn);
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX'],
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const detailed = await Promise.all(
    messages.map(async (m): Promise<SimpleGmailMessage | null> => {
      if (!m.id) return null;

      const res = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'full', // ← metadata → full に変更
      });

      const msg = res.data;
      const headers = msg.payload?.headers ?? [];

      return {
        id: msg.id ?? '',
        threadId: msg.threadId ?? '',
        snippet: msg.snippet ?? '',
        from: extractHeader(headers, 'From'),
        subject: extractHeader(headers, 'Subject'),
        date: extractHeader(headers, 'Date'),
        body: extractBody(msg.payload ?? undefined),
      };
    }),
  );

  return detailed.filter((m): m is SimpleGmailMessage => m !== null);
}