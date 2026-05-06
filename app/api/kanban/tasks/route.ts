import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createTaskSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  lexicalJson: z.string().optional(),
});

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
    },
  });

  return NextResponse.json(task, { status: 201 });
}
