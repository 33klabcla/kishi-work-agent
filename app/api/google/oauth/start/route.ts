import { NextResponse } from 'next/server';
import { buildGoogleAuthUrl } from '@/lib/google/oauth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slackUserId = searchParams.get('slackUserId');

  if (!slackUserId) {
    return NextResponse.json({ error: 'slackUserId is required' }, { status: 400 });
  }

  const { url } = buildGoogleAuthUrl({ slackUserId });
  return NextResponse.redirect(url);
}