/**
 * lib/ai/agent.ts
 *
 * - 「カンバン」系の指示 → JSON コマンドを返して Kanban API を呼ぶ
 * - それ以外          → 自然文で返す
 */

import { generateText } from 'ai';
import { createGeminiModel } from '@/lib/ai/google-model';
import { queryGeap } from '@/lib/ai/geap';
import { env } from '@/lib/security/env';
import { prisma } from '@/lib/db/prisma';
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

type KanbanCommand =
  | { name: 'move_task';   args: { taskId: string; toColumnId: string } }
  | { name: 'create_task'; args: { columnId: string; title: string; description?: string } }
  | { name: 'delete_task'; args: { taskId: string } }
  | { name: 'rename_task'; args: { taskId: string; title: string } }
  | { name: 'create_column'; args: { name: string } }
  | { name: 'noop'; args: Record<string, never> };

// ---------------------------------------------------------------------------
// カンバン指示かどうかを判定するキーワード
// ---------------------------------------------------------------------------
const KANBAN_KEYWORDS = [
  'カンバン', 'かんばん', 'kanban', 'タスク追加', 'タスクを追加',
  'ボードに追加', '登録して', 'ToDo', 'todo', 'In Progress', 'Done',
  'カードを追加', 'カードを作', 'タスクを作', 'タスクを移動', '移動して',
  'カードを移動', 'タスクを削除', 'カードを削除',
];

function isKanbanRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return KANBAN_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

// ---------------------------------------------------------------------------
// context → テキスト変換（自然文用・カンバン用共通）
// ---------------------------------------------------------------------------
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
          .map((m) => {
            const body = m.body ? `\n  本文抜粋: ${m.body.slice(0, 300)}` : '';
            return `- ${m.date ?? ''} from: ${m.from ?? ''} / 件名: ${m.subject ?? ''}${body}`;
          })
          .join('\n');

  return `【今日の予定】\n${eventsSummary}\n\n【最近のメール】\n${messagesSummary}`;
}

// ---------------------------------------------------------------------------
// デフォルトボードを取得
// ---------------------------------------------------------------------------
async function getDefaultBoard() {
  // 最初に見つかるボードを使う（将来はユーザーと board を紐づける）
  return prisma.board.findFirst({
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { order: 'asc' } } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// カンバン操作を実行
// ---------------------------------------------------------------------------
async function applyCommands(commands: KanbanCommand[], boardId: string) {
  for (const cmd of commands) {
    if (cmd.name === 'move_task') {
      await prisma.task.update({
        where: { id: cmd.args.taskId },
        data: { columnId: cmd.args.toColumnId },
      });
    } else if (cmd.name === 'create_task') {
      const max = await prisma.task.aggregate({
        _max: { order: true },
        where: { columnId: cmd.args.columnId },
      });
      await prisma.task.create({
        data: {
          columnId: cmd.args.columnId,
          title: cmd.args.title,
          description: cmd.args.description,
          order: (max._max.order ?? -1) + 1,
        },
      });
    } else if (cmd.name === 'delete_task') {
      await prisma.task.delete({ where: { id: cmd.args.taskId } });
    } else if (cmd.name === 'rename_task') {
      await prisma.task.update({
        where: { id: cmd.args.taskId },
        data: { title: cmd.args.title },
      });
    } else if (cmd.name === 'create_column') {
      const max = await prisma.column.aggregate({
        _max: { order: true },
        where: { boardId },
      });
      await prisma.column.create({
        data: {
          boardId,
          name: cmd.args.name,
          order: (max._max.order ?? -1) + 1,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// カンバン指示の処理
// ---------------------------------------------------------------------------
async function runKanbanAgent(input: AgentInput): Promise<{ text: string }> {
  const model = createGeminiModel();
  const board = await getDefaultBoard();

  if (!board) {
    return { text: 'カンバンボードが見つかりませんでした。先にボードを作成してください。' };
  }

  const contextText = buildContextText(input.context);
  const boardJson = JSON.stringify(
    {
      boardId: board.id,
      boardName: board.name,
      columns: board.columns.map(c => ({
        columnId: c.id,
        columnName: c.name,
        tasks: c.tasks.map(t => ({ taskId: t.id, title: t.title })),
      })),
    },
    null,
    2,
  );

  const system = [
    'あなたはカンバンボード操作アシスタントです。',
    '',
    '## 現在のコンテキスト',
    contextText,
    '',
    '## 現在のボード状態',
    boardJson,
    '',
    'ユーザーの指示を解釈し、必ず以下の JSON 形式だけで返答してください。',
    '{',
    '  "reply": "<日本語の返答（何をしたかを説明）>",',
    '  "commands": [',
    '    { "name": "create_task", "args": { "columnId": "...", "title": "...", "description": "..." } }',
    '  ]',
    '}',
    '',
    '有効なコマンド名: move_task, create_task, delete_task, rename_task, create_column, noop',
    '操作が不要な場合は commands を [] にしてください。',
    'JSON 以外は絶対に出力しないでください。マークダウンコードブロックも不要です。',
  ].join('\n');

  const { text } = await generateText({
    model,
    system,
    prompt: input.prompt,
  });

  const rawText = text.trim();
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : rawText;

  let result: { reply: string; commands: KanbanCommand[] };
  try {
    result = JSON.parse(jsonStr);
  } catch {
    return { text: rawText };
  }

  await applyCommands(result.commands ?? [], board.id);

  const kanbanUrl = `${env.NEXT_PUBLIC_APP_URL ?? 'https://kishi-work-agent.vercel.app'}/kanban?board=${board.shareId}`;
  return {
    text: `${result.reply ?? '完了しました'}\n\nボードを確認: ${kanbanUrl}`,
  };
}

// ---------------------------------------------------------------------------
// 自然文の処理（GEAP / AI SDK）
// ---------------------------------------------------------------------------
async function runWithGeap(input: AgentInput): Promise<{ text: string }> {
  const contextText = buildContextText(input.context);
  const fullMessage = `${contextText}\n\n【ユーザーからの指示】\n${input.prompt}`;
  const { queryGeap: qg } = await import('@/lib/ai/geap');
  const result = await qg({
    prompt: fullMessage,
    userId: input.slackUserId,
    sessionId: `slack-${input.slackUserId}`,
  });
  return { text: result.reply };
}

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

// ---------------------------------------------------------------------------
// エントリーポイント
// ---------------------------------------------------------------------------
export async function runAgent(input: AgentInput): Promise<{ text: string }> {
  // カンバン指示は専用ルートへ
  if (isKanbanRequest(input.prompt)) {
    return runKanbanAgent(input);
  }

  // それ以外は GEAP → AI SDK フォールバック
  const useGeap = Boolean(env.GEAP_RESOURCE_ID);
  if (useGeap) {
    try {
      return await runWithGeap(input);
    } catch (err) {
      console.error('[agent] GEAP failed, falling back to AI SDK', err);
    }
  }

  return runWithAiSdk(input);
}