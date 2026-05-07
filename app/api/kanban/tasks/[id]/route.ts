import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  lexicalJson: z.string().optional(),
  columnId: z.string().optional(),
  order: z.number().int().optional(),
  tagIds: z.array(z.string()).optional(),
});

// PATCH /api/kanban/tasks/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = updateTaskSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { tagIds, ...rest } = body.data;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(tagIds !== undefined && {
        taskTags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
        },
      }),
    },
    include: {
      taskTags: { include: { tag: true } },
    },
  });

  return NextResponse.json(task);
}

// DELETE /api/kanban/tasks/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
