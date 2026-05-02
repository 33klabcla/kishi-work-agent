import { google } from 'googleapis';
import { getGoogleConnectionForSlackUser, buildGoogleAuthClientFromConnection } from './store';

export type SimpleCalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
};

export async function getCalendarEventsToday(
  slackUserId: string,
): Promise<SimpleCalendarEvent[]> {
  const conn = await getGoogleConnectionForSlackUser(slackUserId);
  if (!conn) return [];

  const auth = buildGoogleAuthClientFromConnection(conn);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
  );
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  );

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = res.data.items ?? [];

  return items
    .filter((e) => e.id && (e.start?.dateTime || e.start?.date) && (e.end?.dateTime || e.end?.date))
    .map((e) => ({
      id: e.id!,
      summary: e.summary ?? '(無題の予定)',
      start: e.start!.dateTime ?? e.start!.date!,
      end: e.end!.dateTime ?? e.end!.date!,
    }));
}