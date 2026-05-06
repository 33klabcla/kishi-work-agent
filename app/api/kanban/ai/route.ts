/**
 * POST /api/kanban/ai
 * ユーザーの自然文を GEAP に送り、コマンドを解釈して DB を更新する。
 *
 * Request body:
 *   { prompt: string }
 *
 * Response:
 *   { message: string, commands: KanbanCommand[], columns: Column[] }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { queryGeap } from '@/lib/ai/geap';
import { createGeminiModel } from '@/lib/ai/google-model';
import { generateText } from 'ai';
import { env } from '@/lib/security/env';
import type { KanbanCommand, AiKanbanResponse } from '@/lib/kanban/types';

const bodySchema = z.object({
  prompt: z.string().min(1),
});

// ---- ボード情報をテキストに変換（AI へのコンテキスト）----------------------
async function buildBoardContext(): Promise<string> {
  const columns = await prisma.column.findMany({
    orderBy: { order: 'asc' },
    include: { tasks: { orderBy: { order: 'asc' } } },
  });

  return columns
    .map(col => {
      const taskLines =
        col.tasks.length === 0
          ? '  （タスクなし）'
          : col.tasks.map(t => `  - [${t.id}] ${t.title}`).join('\n');
      return `【${col.name}】(columnId: ${col.id})\n${taskLines}`;
    })
    .join('\n\n');
}

// ---- AI にコマンド JSON を生成させる ----------------------------------------
async function askAi(prompt: string, boardContext: string): Promise<AiKanbanResponse> {
  const systemPrompt = `
あなたは Kanban ボードを操作する AI アシスタントです。
以下のボード状態を踏まえて、ユーザーの指示を JSON コマンドに変換してください。

必ず以下の JSON 形式だけを返してください（他のテキストは不要）:
{
  "message": "ユーザーへの短い返答（日本語）",
  "commands": [
    // 以下から必要なものを配列で
    { "name": "move_task",   "args": { "taskId": "...", "toColumnId": "..." } },
    { "name": "create_task", "args": { "title": "...", "columnId": "...", "description": "..." } },
    { "name": "update_task", "args": { "taskId": "...", "title": "...", "description": "..." } },
    { "name": "delete_task", "args": { "taskId": "..." } }
  ]
}

操作が不要な場合は commands を空配列にしてください。
`;

  const userMessage = `【現在のボード】\n${boardContext}\n\n【ユーザーの指示】\n${prompt}`;

  let rawText: string;

  if (env.GEAP_RESOURCE_ID) {
    try {
      const result = await queryGeap({
        prompt: `${systemPrompt}\n\n${userMessage}`,
        sessionId: `kanban-${Date.now()}`,
      });
      rawText = result.reply;
    } catch (err) {
      console.error('[kanban/ai] GEAP failed, falling back to AI SDK', err);
      const model = createGeminiModel();
      const { text } = await generateText({ model, system: systemPrompt, prompt: userMessage });
      rawText = text;
    }
  } else {
    const model = createGeminiModel();
    const { text } = await generateText({ model, system: systemPrompt, prompt: userMessage });
    rawText = text;
  }

  // JSON 部分だけ抽出
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { message: rawText, commands: [] };

  try {
    return JSON.parse(jsonMatch[0]) as AiKanbanResponse;
  } catch {
    return { message: rawText, commands: [] };
  }
}

// ---- コマンドを DB に適用 ---------------------------------------------------
async function executeCommands(commands: KanbanCommand[]): Promise<void> {
  for (const cmd of commands) {
    try {
      switch (cmd.name) {
        case 'move_task':
          await prisma.task.update({
            where: { id: cmd.args.taskId },
            data: { columnId: cmd.args.toColumnId },
          });
          break;

        case 'create_task': {
          const max = await prisma.task.aggregate({
            where: { columnId: cmd.args.columnId },
            _max: { order: true },
          });
          await prisma.task.create({
            data: {
              title: cmd.args.title,
              description: cmd.args.description,
              columnId: cmd.args.columnId,
              order: (max._max.order ?? 0) + 1,
            },
          });
          break;
        }

        case 'update_task':
          await prisma.task.update({
            where: { id: cmd.args.taskId },
            data: {
              ...(cmd.args.title !== undefined && { title: cmd.args.title }),
              ...(cmd.args.description !== undefined && { description: cmd.args.description }),
            },
          });
          break;

        case 'delete_task':
          await prisma.task.delete({ where: { id: cmd.args.taskId } });
          break;
      }
    } catch (err) {
      console.error('[kanban/ai] command failed', cmd, err);
    }
  }
}

// ---- Route handler ---------------------------------------------------------
export async function POST(req: Request) {
  try {
    const { prompt } = bodySchema.parse(await req.json());
    const boardContext = await buildBoardContext();
    const aiResponse = await askAi(prompt, boardContext);

    await executeCommands(aiResponse.commands);

    // 最新ボードを返す
    const columns = await prisma.column.findMany({
      orderBy: { order: 'asc' },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json({
      message: aiResponse.message,
      commands: aiResponse.commands,
      columns,
    });
  } catch (err) {
    console.error('/api/kanban/ai error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
