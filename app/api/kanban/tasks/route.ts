import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createTaskSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  lexicalJson: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

// GET /api/kanban/tasks?boardId=xxx
export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('boardId');
  if (!boardId) {
    return NextResponse.json({ error: 'boardId required' }, { status: 400 });
  }

  const tasks = await prisma.task.findMany({
    where: { column: { boardId } },
    include: {
      taskTags: {
        include: { tag: true },
      },
    },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json(tasks);
}

// POST /api/kanban/tasks
export async function POST(req: NextRequest) {
  const body = createTaskSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const maxOrder = await prisma.task.aggregate({
    _max: { order: true },
    where: { columnId: body.data.columnId },
  });

  const task = await prisma.task.create({
    data: {
      columnId: body.data.columnId,
      title: body.data.title,
      description: body.data.description,
      lexicalJson: body.data.lexicalJson,
      order: (maxOrder._max.order ?? -1) + 1,
      ...(body.data.tagIds?.length && {
        taskTags: {
          create: body.data.tagIds.map((tagId) => ({ tagId })),
        },
      }),
    },
    include: {
      taskTags: { include: { tag: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
