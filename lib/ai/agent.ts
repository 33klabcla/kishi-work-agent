/**
 * lib/ai/agent.ts
 * エージェント本体。
 *
 * 優先順位:
 *   1. GEAP (Vertex AI Reasoning Engine) — env に GEAP_RESOURCE_ID がある場合
 *   2. Vercel AI SDK + Gemini (generateText) — fallback
 *
 * GEAP への context 渡し方:
 *   Python 側の query() は message: string しか受け取らないため、
 *   Calendar / Gmail の情報を system prompt 相当のテキストとして
 *   message の先頭に付与して送る。
 */

import { generateText } from 'ai';
import { createGeminiModel } from '@/lib/ai/google-model';
import { queryGeap } from '@/lib/ai/geap';
import { env } from '@/lib/security/env';
import type { SimpleCalendarEvent } from '@/lib/google/calendar';
import type { SimpleGmailMessage } from '@/lib/google/gmail';

type AgentInput = {
  prompt: string;
  slackUserId: string;
  context: {
    todayEvents: SimpleCalendarEvent[];
    recentMessages: SimpleGmailMessage[];
  };
};

// ---- context テキスト生成 --------------------------------------------------

function buildContextText(context: AgentInput['context']): string {
  const eventsSummary =
    context.todayEvents.length === 0
      ? '今日の予定はありません。'
      : context.todayEvents
          .map((e) => `- ${e.start} ～ ${e.end}: ${e.summary}`)
          .join('\n');

  const messagesSummary =
    context.recentMessages.length === 0
      ? '最近のメール情報はありません。'
      : context.recentMessages
          .map((m) => `- ${m.date ?? ''} ${m.from ?? ''} / ${m.subject ?? ''}`)
          .join('\n');

  return `【今日の予定】\n${eventsSummary}\n\n【最近のメール】\n${messagesSummary}`;
}

// ---- GEAP 呼び出し ---------------------------------------------------------

async function runWithGeap(input: AgentInput): Promise<{ text: string }> {
  const contextText = buildContextText(input.context);

  // GEAP の message に context を前置して送る
  const fullMessage = `${contextText}\n\n【ユーザーからの指示】\n${input.prompt}`;

  const result = await queryGeap({
    prompt: fullMessage,
    userId: input.slackUserId,
    sessionId: `slack-${input.slackUserId}`,
  });

  return { text: result.reply };
}

// ---- AI SDK fallback -------------------------------------------------------

async function runWithAiSdk(input: AgentInput): Promise<{ text: string }> {
  const model = createGeminiModel();
  const contextText = buildContextText(input.context);

  const systemPrompt = `
あなたは岸さんの仕事を支援するアシスタントです。
以下のコンテキスト情報を踏まえて、ユーザーからの指示に日本語で簡潔に答えてください。
必要であれば予定やメールを引用して構いませんが、機密情報はそのまま長く貼らず、要約してください。
`;

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: `${contextText}\n\n【ユーザーからの指示】\n${input.prompt}`,
  });

  return { text };
}

// ---- エントリーポイント ----------------------------------------------------

export async function runAgent(input: AgentInput): Promise<{ text: string }> {
  const useGeap = Boolean(env.GEAP_RESOURCE_ID);

  if (useGeap) {
    try {
      return await runWithGeap(input);
    } catch (err) {
      console.error('[agent] GEAP failed, falling back to AI SDK', err);
      return runWithAiSdk(input);
    }
  }

  return runWithAiSdk(input);
}
