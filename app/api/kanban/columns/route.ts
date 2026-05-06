import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createColumnSchema = z.object({
  boardId: z.string().min(1),
  name: z.string().min(1).max(80),
  order: z.number().int().optional(),
});

// POST /api/kanban/columns
export async function POST(req: NextRequest) {
  const body = createColumnSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const maxOrder = await prisma.column.aggregate({
    _max: { order: true },
    where: { boardId: body.data.boardId },
  });

  const column = await prisma.column.create({
    data: {
      boardId: body.data.boardId,
      name: body.data.name,
      order: body.data.order ?? (maxOrder._max.order ?? -1) + 1,
    },
    include: { tasks: true },
  });

  return NextResponse.json(column, { status: 201 });
}
