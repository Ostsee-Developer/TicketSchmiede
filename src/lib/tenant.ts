import { auth } from "./auth";
import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: Role;
  isSuperAdmin: boolean;
}

/**
 * Resolves tenant context for a request. Validates that the user
 * has access to the requested tenant.
 */
export async function resolveTenantContext(
  tenantId: string
): Promise<TenantContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id: userId, isSuperAdmin } = session.user;

  // Super admins have access to all non-deleted tenants
  if (isSuperAdmin) {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) return null;
    return { userId, tenantId, role: Role.SUPER_ADMIN, isSuperAdmin: true };
  }

  // Check user's role for this tenant
  const userRole = await prisma.userTenantRole.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });

  if (!userRole) return null;

  return {
    userId,
    tenantId,
    role: userRole.role,
    isSuperAdmin: false,
  };
}

/**
 * Get all tenants a user has access to.
 */
export async function getUserTenants(userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }

  const roles = await prisma.userTenantRole.findMany({
    where: { userId },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, logoUrl: true, isActive: true },
      },
    },
  });

  return roles
    .filter((r) => r.tenant.isActive)
    .map((r) => ({ ...r.tenant, role: r.role }));
}

