import crypto from 'crypto';
import { env } from '@/lib/security/env';

type VerifyInput = {
  rawBody: string;
  signature: string;
  timestamp: string;
};

export function verifySlackRequest(input: VerifyInput) {
  const { rawBody, signature, timestamp } = input;

  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 60 * 5;

  if (Math.abs(now - ts) > fiveMinutes) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected =
    'v0=' +
    crypto
      .createHmac('sha256', env.SLACK_SIGNING_SECRET)
      .update(baseString)
      .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8'),
    );
  } catch {
    return false;
  }
}

type PostSlackMessageInput = {
  channel: string;
  text: string;
  thread_ts?: string;
};

export async function postSlackMessage(input: PostSlackMessageInput) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack chat.postMessage failed: ${data.error ?? 'unknown_error'}`);
  }

  return data;
}