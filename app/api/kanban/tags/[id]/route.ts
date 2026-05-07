import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

// PATCH /api/kanban/tags/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = updateTagSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const tag = await prisma.tag.update({
    where: { id },
    data: body.data,
  });
  return NextResponse.json(tag);
}

// DELETE /api/kanban/tags/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.tag.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
