import { AuditAction, Prisma } from "@prisma/client";
import { headers } from "next/headers";
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
  let userEmail = options.userEmail ?? null;
  let ipAddress = options.ipAddress ?? null;
  let userAgent = options.userAgent ?? null;

  if (!userEmail && options.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: options.userId },
        select: { email: true },
      });
      userEmail = user?.email ?? null;
    } catch (_error) {
      // Audit logging must stay best-effort.
    }
  }

  if (!ipAddress || !userAgent) {
    try {
      const headerStore = await headers();
      const info = getClientInfoFromHeaders(headerStore);
      ipAddress = ipAddress ?? info.ipAddress;
      userAgent = userAgent ?? info.userAgent;
    } catch (_error) {
      // Route handlers usually pass Request explicitly; background work may not have headers.
    }
  }

  const data = {
    tenantId: options.tenantId ?? null,
    userId: options.userId ?? null,
    userEmail,
    action: options.action,
    resource: options.resource ?? null,
    resourceId: options.resourceId ?? null,
    details: options.details ? (options.details as Prisma.InputJsonObject) : Prisma.JsonNull,
    ipAddress,
    userAgent,
  };

  try {
    if (await isDuplicateAuditLog(data)) return;
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
  return getClientInfoFromHeaders(request.headers);
}

function getClientInfoFromHeaders(headers: Pick<Headers, "get">): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress = getForwardedIp(headers);
  const userAgent = headers.get("user-agent") ?? null;
  return { ipAddress, userAgent };
}

function getForwardedIp(headers: Pick<Headers, "get">): string | null {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-client-ip"),
    headers.get("fastly-client-ip"),
    headers.get("x-forwarded-for"),
    headers.get("forwarded"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const value = candidate
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);
    const normalized = normalizeIp(value ?? null);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeIp(value: string | null): string | null {
  if (!value) return null;

  let ip = value;
  const forwardedFor = /for="?([^";,]+)"?/i.exec(ip);
  if (forwardedFor?.[1]) ip = forwardedFor[1];

  ip = ip.trim().replace(/^::ffff:/i, "");
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }

  return ip || null;
}

async function isDuplicateAuditLog(data: {
  tenantId: string | null;
  userId: string | null;
  userEmail: string | null;
  action: AuditAction;
  resource: string | null;
  resourceId: string | null;
  ipAddress: string | null;
}) {
  const duplicateWindowMs = 3000;
  const recent = await prisma.auditLog.findFirst({
    where: {
      tenantId: data.tenantId,
      userId: data.userId,
      userEmail: data.userEmail,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      ipAddress: data.ipAddress,
      createdAt: { gte: new Date(Date.now() - duplicateWindowMs) },
    },
    select: { id: true },
  });

  return Boolean(recent);
}

