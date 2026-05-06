import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/kanban/tasks/[id] — タイトル / カラム移動 / 説明を更新
const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  columnId: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = updateSchema.parse(await req.json());
  const task = await prisma.task.update({
    where: { id },
    data: body,
  });
  return NextResponse.json({ task });
}

// DELETE /api/kanban/tasks/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
