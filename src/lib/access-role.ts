import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getLatestUserRole(userId: string): Promise<Role | null> {
  const role = await prisma.userTenantRole.findFirst({
    where: { userId },
    select: { role: true },
    orderBy: { createdAt: "desc" },
  });

  return role?.role ?? null;
}

export function isEmployeePortalRole(role: Role | null): boolean {
  return role === Role.CUSTOMER_USER;
}
