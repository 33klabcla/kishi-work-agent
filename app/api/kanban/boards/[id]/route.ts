import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/kanban/boards/:id  — ボード名変更
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const schema = z.object({ name: z.string().min(1).max(100) });
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const board = await prisma.board.update({
    where: { id },
    data: { name: body.data.name },
  });
  return NextResponse.json(board);
}

// DELETE /api/kanban/boards/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.board.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
