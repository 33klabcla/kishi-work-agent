import { google } from 'googleapis';
import { prisma } from '@/lib/db/prisma';
import { decryptString } from '@/lib/security/crypto';
import { createGoogleOAuthClient } from '@/lib/google/oauth';

export async function getGoogleClientForSlackUser(slackUserId: string) {
  const user = await prisma.user.findUnique({
    where: { slackUserId },
    include: { googleConnections: true },
  });

  const connection = user?.googleConnections.find(c => c.status === 'ACTIVE');

  if (!user || !connection) {
    throw new Error('Google account is not connected for this Slack user.');
  }

  const client = createGoogleOAuthClient();
  client.setCredentials({
    access_token: decryptString(connection.accessTokenEncrypted),
    refresh_token: connection.refreshTokenEncrypted
      ? decryptString(connection.refreshTokenEncrypted)
      : undefined,
  });

  return { user, connection, client };
}

export function gmail(client: ReturnType<typeof createGoogleOAuthClient>) {
  return google.gmail({ version: 'v1', auth: client });
}

export function calendar(client: ReturnType<typeof createGoogleOAuthClient>) {
  return google.calendar({ version: 'v3', auth: client });
}