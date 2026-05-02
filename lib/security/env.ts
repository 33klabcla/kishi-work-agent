import { z } from 'zod';

const envSchema = z.object({
  APP_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY_BASE64: z.string().min(1),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.5-pro'),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),
  GOOGLE_OAUTH_SCOPES: z.string().min(1),
  AGENT_ALLOWED_SLACK_USER_IDS: z.string().optional(),
  AGENT_ALLOWED_SLACK_CHANNEL_IDS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse({
  APP_BASE_URL: process.env.APP_BASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  ENCRYPTION_KEY_BASE64: process.env.ENCRYPTION_KEY_BASE64,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  GOOGLE_OAUTH_SCOPES: process.env.GOOGLE_OAUTH_SCOPES,
  AGENT_ALLOWED_SLACK_USER_IDS: process.env.AGENT_ALLOWED_SLACK_USER_IDS,
  AGENT_ALLOWED_SLACK_CHANNEL_IDS: process.env.AGENT_ALLOWED_SLACK_CHANNEL_IDS,
  NODE_ENV: process.env.NODE_ENV,
});

export const oauthScopes = env.GOOGLE_OAUTH_SCOPES.split(/\s+/).filter(Boolean);

export const allowedSlackUsers = new Set(
  (env.AGENT_ALLOWED_SLACK_USER_IDS ?? '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean),
);

export const allowedSlackChannels = new Set(
  (env.AGENT_ALLOWED_SLACK_CHANNEL_IDS ?? '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean),
);