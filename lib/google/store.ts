import { google } from 'googleapis';
import { prisma } from '@/lib/db/prisma';
import { decryptString } from '@/lib/security/crypto';
import { env } from '@/lib/security/env';

export type GoogleConnectionWithUser = {
  userId: string;
  googleSubject: string;
  googleEmail: string;
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: Date | null;
  grantedScopes: string[];
};

export async function getGoogleConnectionForSlackUser(
  slackUserId: string,
): Promise<GoogleConnectionWithUser | null> {
  const user = await prisma.user.findUnique({
    where: { slackUserId },
    include: { googleConnections: true },
  });

  if (!user) return null;

  const active = user.googleConnections.find((c) => c.status === 'ACTIVE');
  if (!active) return null;

  return {
    userId: user.id,
    googleSubject: active.googleSubject,
    googleEmail: active.googleEmail,
    accessToken: decryptString(active.accessTokenEncrypted),
    refreshToken: active.refreshTokenEncrypted
      ? decryptString(active.refreshTokenEncrypted)
      : null,
    expiryDate: active.expiryDate,
    grantedScopes: active.grantedScopes,
  };
}

export function buildGoogleAuthClientFromConnection(conn: GoogleConnectionWithUser) {
  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );

  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken ?? undefined,
    expiry_date: conn.expiryDate?.getTime(),
  });

  return client;
}