import { prisma } from '@/lib/db/prisma';

export async function writeAuditLog(input: {
  userId?: string;
  eventType: string;
  actor: string;
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      actor: input.actor,
      target: input.target,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  });
}