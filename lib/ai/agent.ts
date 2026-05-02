import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
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

export async function runAgent(input: AgentInput) {
  const { prompt, context } = input;

  const model = google(env.GEMINI_MODEL, {
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const eventsSummary =
    context.todayEvents.length === 0
      ? '今日の予定はありません。'
      : context.todayEvents
          .map(
            (e) => `- ${e.start} ～ ${e.end}: ${e.summary}`,
          )
          .join('\n');

  const messagesSummary =
    context.recentMessages.length === 0
      ? '最近のメール情報はありません。'
      : context.recentMessages
          .map(
            (m) => `- ${m.date ?? ''} ${m.from ?? ''} / ${m.subject ?? ''}`,
          )
          .join('\n');

  const systemPrompt = `
あなたは岸さんの仕事を支援するアシスタントです。
以下の「今日の予定」と「最近のメール」を踏まえて、ユーザーからの指示に日本語で簡潔に答えてください。
必要であれば予定やメールを引用して構いませんが、機密情報はそのまま長く貼らず、要約してください。
`;

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: `
ユーザーからの指示: ${prompt}

今日の予定:
${eventsSummary}

最近のメール:
${messagesSummary}
`,
  });

  return { text };
}