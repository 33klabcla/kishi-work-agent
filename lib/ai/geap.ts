/**
 * lib/ai/geap.ts
 * Vertex AI Reasoning Engine (GEAP) REST クライアント
 *
 * Python 側で deploy した custom app を Node.js から呼び出す。
 * GCP の REST API を直接 fetch する方式（npm パッケージ不要）。
 *
 * 必要な env vars:
 *   GEAP_PROJECT_NUMBER   : 例 6503033033
 *   GEAP_LOCATION         : 例 asia-northeast1
 *   GEAP_RESOURCE_ID      : 例 5538750242503000064
 *   GCP_SERVICE_ACCOUNT_JSON: サービスアカウントキー JSON（文字列）
 */

import { env } from '@/lib/security/env';

// ---- JWT / GCP access token ------------------------------------------------

/** base64url encode (Node.js built-in Buffer で実装) */
function base64url(input: string | Uint8Array): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return buf.toString('base64url');
}

/** RS256 で JWT を署名して GCP アクセストークンを取得する */
async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signingInput = `${header}.${claim}`;

  // PEM → CryptoKey
  const pemBody = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binaryDer = Buffer.from(pemBody, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput, 'utf8'),
  );

  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`;

  // JWT → access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`GCP token fetch failed: ${tokenRes.status} ${errText}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token: string };
  return tokenJson.access_token;
}

// ---- アクセストークンキャッシュ -------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getCachedAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  const token = await getAccessToken();
  cachedToken = { token, expiresAt: now + 3_500_000 }; // ~58 min
  return token;
}

// ---- GEAP query ------------------------------------------------------------

export type GeapInput = {
  prompt: string;
  userId?: string;
  sessionId?: string;
};

export type GeapOutput = {
  reply: string;
  model: string;
  session_id: string;
  user_id: string;
  raw?: unknown;
};

/**
 * GEAP Reasoning Engine を呼び出して返答を得る。
 *
 * Python 側の query() が受け取るスキーマ:
 *   { message: string, user_id: string, session_id: string }
 *
 * 返却スキーマ:
 *   { reply: string, model: string, session_id: string, user_id: string }
 */
export async function queryGeap(input: GeapInput): Promise<GeapOutput> {
  const { GEAP_PROJECT_NUMBER, GEAP_LOCATION, GEAP_RESOURCE_ID } = env;

  const endpoint =
    `https://${GEAP_LOCATION}-aiplatform.googleapis.com/v1beta1/` +
    `projects/${GEAP_PROJECT_NUMBER}/locations/${GEAP_LOCATION}/` +
    `reasoningEngines/${GEAP_RESOURCE_ID}:query`;

  const accessToken = await getCachedAccessToken();

  const body = {
    input: {
      message: input.prompt,
      user_id: input.userId ?? 'anonymous',
      session_id: input.sessionId ?? `session-${Date.now()}`,
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GEAP query failed: ${res.status} ${errText}`);
  }

  // Reasoning Engine の返却は { output: { reply, model, session_id, user_id } }
  const json = (await res.json()) as { output: GeapOutput };
  return { ...json.output, raw: json };
}
