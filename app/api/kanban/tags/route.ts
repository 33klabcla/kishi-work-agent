import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

// GET /api/kanban/tags
export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(tags);
}

// POST /api/kanban/tags
export async function POST(req: NextRequest) {
  const body = createTagSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const tag = await prisma.tag.upsert({
    where: { name: body.data.name },
    create: {
      name: body.data.name,
      color: body.data.color ?? '#6366f1',
      description: body.data.description,
    },
    update: {
      color: body.data.color ?? '#6366f1',
      description: body.data.description,
    },
  });

  return NextResponse.json(tag, { status: 201 });
}
