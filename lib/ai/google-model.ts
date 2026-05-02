import { google } from '@ai-sdk/google';
import { env } from '@/lib/security/env';

/**
 * Gemini モデルを生成するヘルパー。
 * API キーは env から process.env に流し込み、
 * google() には追加設定を渡さずに呼び出す。
 */
export function createGeminiModel(modelName?: string) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;
  return google(modelName ?? env.GEMINI_MODEL);
}