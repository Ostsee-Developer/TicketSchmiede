import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { resolveTenantContext } from "./tenant";
import { hasMinRole } from "./permissions";

type PasskeyAccess =
  | {
      allowed: true;
      tenantId: string | null;
      target: { id: string; email: string; name: string };
    }
  | {
      allowed: false;
      tenantId?: null;
      target?: null;
    };

export async function canManageUserPasskeys(params: {
  actorId: string;
  actorIsSuperAdmin: boolean;
  targetUserId: string;
  tenantId?: string | null;
}): Promise<PasskeyAccess> {
  if (params.actorIsSuperAdmin) {
    const target = await prisma.user.findFirst({
      where: {
        id: params.targetUserId,
        ...(params.tenantId ? { tenantRoles: { some: { tenantId: params.tenantId } } } : {}),
      },
      select: { id: true, email: true, name: true },
    });
    return target ? { allowed: true, tenantId: params.tenantId ?? null, target } : { allowed: false };
  }

  if (!params.tenantId) return { allowed: false };

  const ctx = await resolveTenantContext(params.tenantId);
  if (!ctx || !hasMinRole(ctx.role, Role.TECHNICIAN)) return { allowed: false };

  const target = await prisma.user.findFirst({
    where: {
      id: params.targetUserId,
      tenantRoles: { some: { tenantId: params.tenantId } },
    },
    select: { id: true, email: true, name: true },
  });

  return target ? { allowed: true, tenantId: params.tenantId, target } : { allowed: false };
}

export async function listManageablePasskeyUsers(params: {
  actorId: string;
  actorIsSuperAdmin: boolean;
  tenantId?: string | null;
}) {
  if (params.actorIsSuperAdmin) {
    return prisma.user.findMany({
      where: params.tenantId ? { tenantRoles: { some: { tenantId: params.tenantId } } } : undefined,
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        tenantRoles: { include: { tenant: { select: { id: true, name: true } } } },
        passkeys: { select: { id: true, name: true, createdAt: true, lastUsedAt: true } },
      },
    });
  }

  if (!params.tenantId) return [];
  const ctx = await resolveTenantContext(params.tenantId);
  if (!ctx || !hasMinRole(ctx.role, Role.TECHNICIAN)) return [];

  return prisma.user.findMany({
    where: { tenantRoles: { some: { tenantId: params.tenantId } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      tenantRoles: { include: { tenant: { select: { id: true, name: true } } } },
      passkeys: { select: { id: true, name: true, createdAt: true, lastUsedAt: true } },
    },
  });
}
