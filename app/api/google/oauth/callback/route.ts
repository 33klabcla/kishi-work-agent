import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type OAuthState = {
  slackUserId: string;
  redirectTo?: string;
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
  picture?: string;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Google OAuth error: ${error}` },
      { status: 400 },
    );
  }

  if (!code || !stateParam) {
    return NextResponse.json(
      { ok: false, error: 'Missing code or state.' },
      { status: 400 },
    );
  }

  let state: OAuthState;

  try {
    state = JSON.parse(stateParam) as OAuthState;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid state.' },
      { status: 400 },
    );
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return NextResponse.json(
        { ok: false, error: `Failed to exchange token: ${text}` },
        { status: 400 },
      );
    }

    const token = (await tokenRes.json()) as GoogleTokenResponse;

    const profileRes = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      },
    );

    if (!profileRes.ok) {
      const text = await profileRes.text();
      return NextResponse.json(
        { ok: false, error: `Failed to fetch Google profile: ${text}` },
        { status: 400 },
      );
    }

    const profile = (await profileRes.json()) as GoogleUserInfo;

    const expiresAt =
      typeof token.expires_in === 'number'
        ? new Date(Date.now() + token.expires_in * 1000)
        : null;

    const scopes = token.scope
      ? token.scope.split(' ').filter(Boolean)
      : [];

    await prisma.user.upsert({
      where: { slackUserId: state.slackUserId },
      create: {
        slackUserId: state.slackUserId,
        email: profile.email,
        name: profile.name,
        image: profile.picture,
        googleAccessToken: token.access_token,
        googleRefreshToken: token.refresh_token,
        googleTokenExpiry: expiresAt,
        googleScopes: scopes,
      },
      update: {
        email: profile.email,
        name: profile.name,
        image: profile.picture,
        googleAccessToken: token.access_token,
        googleRefreshToken: token.refresh_token,
        googleTokenExpiry: expiresAt,
        googleScopes: scopes,
      },
    });

    const redirectTo = state.redirectTo || '/';

    return NextResponse.redirect(new URL(redirectTo, req.url));
  } catch (error) {
    console.error('/api/google/oauth/callback error:', error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Google OAuth callback error',
      },
      { status: 500 },
    );
  }
}