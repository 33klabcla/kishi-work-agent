import crypto from 'crypto';
import { env } from '@/lib/security/env';

export function verifySlackSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
) {
  if (!signature || !timestamp) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const hash =
    'v0=' +
    crypto.createHmac('sha256', env.SLACK_SIGNING_SECRET).update(base).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}