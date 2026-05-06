import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// GET /api/kanban/columns — ボード全体（カラム + タスク）を返す
export async function GET() {
  const columns = await prisma.column.findMany({
    orderBy: { order: 'asc' },
    include: {
      tasks: { orderBy: { order: 'asc' } },
    },
  });
  return NextResponse.json({ columns });
}

// POST /api/kanban/columns — カラムを追加
const createSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional(),
});

export async function POST(req: Request) {
  const body = createSchema.parse(await req.json());
  const max = await prisma.column.aggregate({ _max: { order: true } });
  const column = await prisma.column.create({
    data: {
      name: body.name,
      order: body.order ?? (max._max.order ?? 0) + 1,
    },
  });
  return NextResponse.json({ column }, { status: 201 });
}
