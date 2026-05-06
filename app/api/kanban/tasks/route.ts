import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// POST /api/kanban/tasks — タスクを追加
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  columnId: z.string().min(1),
});

export async function POST(req: Request) {
  const body = createSchema.parse(await req.json());
  const max = await prisma.task.aggregate({
    where: { columnId: body.columnId },
    _max: { order: true },
  });
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      columnId: body.columnId,
      order: (max._max.order ?? 0) + 1,
    },
  });
  return NextResponse.json({ task }, { status: 201 });
}
