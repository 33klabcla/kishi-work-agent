/**
 * POST /api/kanban/ai
 * body: { boardId: string; message: string; userId?: string }
 *
 * Gemini (Vercel AI SDK) でカンバン操作の指示を解釈し、
 * JSON コマンドを受け取って DB に適用する。
 * GEAP / Cloud Run プロキシには依存しない。
 *
 * 返却: { reply: string; commands: KanbanCommand[]; board: Board }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { env } from '@/lib/security/env';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------
const bodySchema = z.object({
  boardId: z.string().min(1),
  message: z.string().min(1),
  userId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// コマンド型
// ---------------------------------------------------------------------------
type KanbanCommand =
  | { name: 'move_task';   args: { taskId: string; toColumnId: string } }
  | { name: 'create_task'; args: { columnId: string; title: string; description?: string } }
  | { name: 'delete_task'; args: { taskId: string } }
  | { name: 'rename_task'; args: { taskId: string; title: string } }
  | { name: 'create_column'; args: { name: string } }
  | { name: 'noop'; args: Record<string, never> };

// ---------------------------------------------------------------------------
// ボード状態を system prompt に変換
// ---------------------------------------------------------------------------
async function buildSystemPrompt(boardId: string): Promise<string> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!board) throw new Error('Board not found');

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

  return [
    'あなたはカンバンボード操作アシスタントです。',
    '現在のボード状態:',
    boardJson,
    '',
    'ユーザーの指示を解釈し、必ず以下の JSON 形式だけで返答してください。',
    '{',
    '  "reply": "<日本語の返答>",',
    '  "commands": [',
    '    { "name": "move_task", "args": { "taskId": "...", "toColumnId": "..." } }',
    '  ]',
    '}',
    '',
    '有効なコマンド名: move_task, create_task, delete_task, rename_task, create_column, noop',
    '操作が不要な場合は commands を [] にしてください。',
    'JSON 以外は絶対に出力しないでください。マークダウンコードブロックも不要です。',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// DB へコマンドを適用
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
    // noop: 何もしない
  }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { boardId, message } = parsed.data;

  // system prompt にボード状態を埋め込む
  let system: string;
  try {
    system = await buildSystemPrompt(boardId);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }

  // Gemini 呼び出し
  let rawText: string;
  try {
    const { text } = await generateText({
      model: google(env.GEMINI_MODEL),
      system,
      prompt: message,
    });
    rawText = text.trim();
  } catch (e) {
    return NextResponse.json(
      { error: 'Gemini call failed', detail: String(e) },
      { status: 502 },
    );
  }

  // JSON 抽出（```json ... ``` ブロックにも念のため対応）
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : rawText;

  let result: { reply: string; commands: KanbanCommand[] };
  try {
    result = JSON.parse(jsonStr);
  } catch {
    // JSON パース失敗時はそのまま reply として返す
    result = { reply: rawText, commands: [] };
  }

  // コマンドを DB に適用
  await applyCommands(result.commands ?? [], boardId);

  // 最新ボード状態を取得して返す
  const updatedBoard = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { order: 'asc' } } },
      },
    },
  });

  return NextResponse.json({
    reply: result.reply ?? '完了しました',
    commands: result.commands ?? [],
    board: updatedBoard,
  });
}
