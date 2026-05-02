import crypto from 'crypto';
import { google } from 'googleapis';
import { env, oauthScopes } from '@/lib/security/env';

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

export function buildGoogleAuthUrl(statePayload: Record<string, string>) {
  const state = Buffer.from(
    JSON.stringify({
      ...statePayload,
      nonce: crypto.randomBytes(16).toString('hex'),
    }),
  ).toString('base64url');

  const client = createGoogleOAuthClient();

  const url = client.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: oauthScopes,
    state,
  });

  return { url, state };
}

export function parseState(state: string | null) {
  if (!state) return null;

  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as Record<string, string>;
  } catch {
    return null;
  }
}