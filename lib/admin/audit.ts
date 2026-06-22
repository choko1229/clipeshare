import { prisma } from "@/lib/db/prisma";

type AuditInput = {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeData: input.beforeData === undefined ? undefined : toJson(input.beforeData),
      afterData: input.afterData === undefined ? undefined : toJson(input.afterData),
      reason: input.reason ?? null,
    },
  });
}

function toJson(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => (typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue)),
  );
}
