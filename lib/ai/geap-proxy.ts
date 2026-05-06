/**
 * Cloud Run プロキシ経由で GEAP (Vertex AI Reasoning Engine) を呼び出す。
 *
 * 組織ポリシーでサービスアカウントキーの作成が禁止されている場合に使用する。
 * Cloud Run 側は Attached Service Account でキーレス認証する。
 * Vercel → Cloud Run は X-Api-Key ヘッダーで簡易認証する。
 */
import { env } from '@/lib/security/env';

export type GeapProxyInput = {
  message: string;
  userId?: string;
  sessionId?: string;
};

export type GeapProxyOutput = {
  reply: string;
  model?: string;
  session_id?: string;
  user_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
};

/**
 * Cloud Run プロキシの /query を叩く。
 * GEAP_PROXY_URL が未設定の場合は例外を投げる。
 */
export async function queryGeapViaProxy(
  input: GeapProxyInput,
): Promise<GeapProxyOutput> {
  if (!env.GEAP_PROXY_URL) {
    throw new Error(
      'GEAP_PROXY_URL is not configured. ' +
        'Set it in Vercel Environment Variables.',
    );
  }

  const url = env.GEAP_PROXY_URL.replace(/\/$/, '') + '/query';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.GEAP_PROXY_API_KEY
        ? { 'X-Api-Key': env.GEAP_PROXY_API_KEY }
        : {}),
    },
    body: JSON.stringify({
      message: input.message,
      user_id: input.userId ?? 'anonymous',
      session_id: input.sessionId ?? `session-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `GEAP proxy query failed: ${res.status} ${res.statusText} — ${errText}`,
    );
  }

  // Cloud Run proxy は Reasoning Engine のレスポンスをそのまま返す。
  // 形式: { output: { reply, model, session_id, user_id } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;

  // output キーがある場合はそれを使い、なければ全体を返す。
  const output: GeapProxyOutput = json?.output ?? json;
  output.raw = json;
  return output;
}

/** GEAP_PROXY_URL が設定されているかを確認するヘルパー */
export function isProxyConfigured(): boolean {
  return Boolean(env.GEAP_PROXY_URL);
}
