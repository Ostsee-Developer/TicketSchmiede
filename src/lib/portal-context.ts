import { auth } from "./auth";
import { prisma } from "./prisma";
import { Role } from "@prisma/client";

export interface PortalContext {
  userId: string;
  tenantId: string;
  tenantName: string;
  role: Role;
  userName: string;
  userEmail: string;
  isCustomerAdmin: boolean;
}

/**
 * Resolves the portal context for a customer user.
 * Returns null if the user has no tenant assignment or is not a customer role.
 */
export async function getPortalContext(): Promise<PortalContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id: userId, name: userName, email: userEmail } = session.user;

  const userRole = await prisma.userTenantRole.findFirst({
    where: {
      userId,
      role: { in: [Role.CUSTOMER_ADMIN, Role.CUSTOMER_USER] },
      tenant: { isActive: true, deletedAt: null },
    },
    include: {
      tenant: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!userRole) return null;

  return {
    userId,
    tenantId: userRole.tenant.id,
    tenantName: userRole.tenant.name,
    role: userRole.role,
    userName: userName ?? userEmail,
    userEmail,
    isCustomerAdmin: userRole.role === Role.CUSTOMER_ADMIN,
  };
}
