import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// GET /api/kanban/boards?shareId=xxx  — ボード一覧 or shareId で単一取得
export async function GET(req: NextRequest) {
  const shareId = req.nextUrl.searchParams.get('shareId');

  if (shareId) {
    const board = await prisma.board.findUnique({
      where: { shareId },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: { tasks: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(board);
  }

  const boards = await prisma.board.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { order: 'asc' } } },
      },
    },
  });
  return NextResponse.json(boards);
}

const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
});

// POST /api/kanban/boards  — ボード作成（デフォルト 3 カラム付き）
export async function POST(req: NextRequest) {
  const body = createBoardSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const board = await prisma.board.create({
    data: {
      name: body.data.name,
      columns: {
        create: [
          { name: 'Todo', order: 0 },
          { name: 'In Progress', order: 1 },
          { name: 'Done', order: 2 },
        ],
      },
    },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { order: 'asc' } } },
      },
    },
  });

  return NextResponse.json(board, { status: 201 });
}
