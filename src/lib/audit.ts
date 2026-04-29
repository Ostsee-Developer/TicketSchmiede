import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

interface AuditOptions {
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAuditLog(options: AuditOptions): Promise<void> {
  const data = {
    tenantId: options.tenantId ?? null,
    userId: options.userId ?? null,
    userEmail: options.userEmail ?? null,
    action: options.action,
    resource: options.resource ?? null,
    resourceId: options.resourceId ?? null,
    details: options.details ? (options.details as Prisma.InputJsonObject) : Prisma.JsonNull,
    ipAddress: options.ipAddress ?? null,
    userAgent: options.userAgent ?? null,
  };

  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    // FK violation on userId (stale JWT after DB reset) — retry without the FK reference.
    // userEmail is already denormalized so the log entry remains useful.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003" &&
      String(error.meta?.field_name ?? "").toLowerCase().includes("userid")
    ) {
      try {
        await prisma.auditLog.create({ data: { ...data, userId: null } });
        return;
      } catch (_e) {
        // fall through to error log
      }
    }
    // Never let audit log failures break the main flow
    console.error("[AuditLog] Failed to create audit log:", error);
  }
}

export function getClientInfo(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? realIp ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;
  return { ipAddress, userAgent };
}

export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const changes: string[] = [];
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      changes.push(key);
    }
  }

  return changes;
}
