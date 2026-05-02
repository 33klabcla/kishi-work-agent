import { google } from 'googleapis';
import { getGoogleConnectionForSlackUser, buildGoogleAuthClientFromConnection } from './store';

export type SimpleGmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  subject?: string;
  date?: string;
};

function extractHeader(headers: { name?: string; value?: string }[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
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
    messages.map(async (m) => {
      if (!m.id) return null;

      const res = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const msg = res.data;
      const headers = msg.payload?.headers ?? [];

      return {
        id: msg.id!,
        threadId: msg.threadId ?? '',
        snippet: msg.snippet ?? '',
        from: extractHeader(headers, 'From'),
        subject: extractHeader(headers, 'Subject'),
        date: extractHeader(headers, 'Date'),
      } as SimpleGmailMessage;
    }),
  );

  return detailed.filter((m): m is SimpleGmailMessage => m !== null);
}