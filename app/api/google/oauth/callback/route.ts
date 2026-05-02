import { NextResponse } from 'next/server';
import { createGoogleOAuthClient, parseState } from '@/lib/google/oauth';
import { prisma } from '@/lib/db/prisma';
import { encryptString } from '@/lib/security/crypto';
import { writeAuditLog } from '@/lib/security/audit';

function decodeJwtPayload<T>(token: string): T {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid ID token payload.');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as T;
}

type GoogleIdTokenPayload = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const state = parseState(url.searchParams.get('state'));

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    if (!code || !state?.slackUserId) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('Missing access token.');
    }

    if (!tokens.id_token) {
      throw new Error('Missing id_token. Make sure openid email profile scopes are included.');
    }

    const profile = decodeJwtPayload<GoogleIdTokenPayload>(tokens.id_token);

    if (!profile.sub) {
      throw new Error('Missing Google subject in id_token.');
    }

    const user = await prisma.user.upsert({
      where: { slackUserId: state.slackUserId },
      create: {
        slackUserId: state.slackUserId,
        email: profile.email,
        displayName: profile.name,
      },
      update: {
        email: profile.email,
        displayName: profile.name,
      },
    });

    await prisma.googleConnection.upsert({
      where: {
        userId_googleSubject: {
          userId: user.id,
          googleSubject: profile.sub,
        },
      },
      create: {
        userId: user.id,
        googleSubject: profile.sub,
        googleEmail: profile.email ?? '',
        grantedScopes: (tokens.scope ?? '').split(' ').filter(Boolean),
        accessTokenEncrypted: encryptString(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token ? encryptString(tokens.refresh_token) : null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        googleEmail: profile.email ?? '',
        grantedScopes: (tokens.scope ?? '').split(' ').filter(Boolean),
        accessTokenEncrypted: encryptString(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? encryptString(tokens.refresh_token)
          : undefined,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        status: 'ACTIVE',
      },
    });

    await writeAuditLog({
      userId: user.id,
      actor: 'google-oauth',
      eventType: 'google.oauth.connected',
      metadata: {
        scopes: tokens.scope,
        googleEmail: profile.email,
        emailVerified: profile.email_verified,
      },
    });

    return NextResponse.redirect(new URL('/connect-google?status=success', req.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown OAuth callback error',
      },
      { status: 500 },
    );
  }
}