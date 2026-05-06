/**
 * Vertex AI Reasoning Engine (GEAP) を直接呼び出すヘルパー。
 *
 * 現在の Kanban UI では Gemini 直接呼び出しを使っているが、
 * このファイルは他の用途や将来の切り替えのために残している。
 * build 時に TypeScript が検査するため、env の undefined を安全に扱う。
 */
import crypto from 'node:crypto';
import { env } from '@/lib/security/env';

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

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** RS256 で JWT を署名して GCP アクセストークンを取得する */
async function getAccessToken(): Promise<string> {
  const serviceAccountJson = env.GCP_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      'GCP_SERVICE_ACCOUNT_JSON is not set. ' +
        'If you do not use GEAP directly, avoid calling queryGeap().',
    );
  }

  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    token_uri?: string;
  };

  if (!sa.client_email || !sa.private_key) {
    throw new Error(
      'Invalid GCP_SERVICE_ACCOUNT_JSON: client_email or private_key is missing.',
    );
  }

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);

  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const unsignedJwt = `${header}.${claim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();

  const signature = signer.sign(sa.private_key);
  const jwt = `${unsignedJwt}.${base64url(signature)}`;

  const tokenRes = await fetch(
    sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    },
  );

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(
      `Failed to get GCP access token: ${tokenRes.status} ${errText}`,
    );
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
  };

  if (!tokenJson.access_token) {
    throw new Error('access_token was not returned from Google OAuth.');
  }

  return tokenJson.access_token;
}

/** Vertex AI Reasoning Engine を直接呼び出す */
export async function queryGeap(input: GeapInput): Promise<GeapOutput> {
  if (!env.GEAP_PROJECT_NUMBER || !env.GEAP_RESOURCE_ID) {
    throw new Error(
      'GEAP_PROJECT_NUMBER or GEAP_RESOURCE_ID is not set. ' +
        'Direct GEAP call is not configured.',
    );
  }

  const location = env.GEAP_LOCATION || 'asia-northeast1';
  const accessToken = await getAccessToken();

  const endpoint =
    `https://${location}-aiplatform.googleapis.com/v1beta1/` +
    `projects/${env.GEAP_PROJECT_NUMBER}/locations/${location}/` +
    `reasoningEngines/${env.GEAP_RESOURCE_ID}:query`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        message: input.prompt,
        user_id: input.userId ?? 'anonymous',
        session_id: input.sessionId ?? `session-${Date.now()}`,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GEAP query failed: ${res.status} ${errText}`);
  }

  const json = (await res.json()) as {
    output?: {
      reply?: string;
      model?: string;
      session_id?: string;
      user_id?: string;
    };
  };

  return {
    reply: json.output?.reply ?? '',
    model: json.output?.model ?? 'unknown',
    session_id: json.output?.session_id ?? input.sessionId ?? '',
    user_id: json.output?.user_id ?? input.userId ?? 'anonymous',
    raw: json,
  };
}