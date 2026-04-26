import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserManagement } from "./_components/UserManagement";

export const metadata = { title: "Benutzer & Rechte" };

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
      isActive: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      failedLoginCount: true,
      lockedUntil: true,
      createdAt: true,
      tenantRoles: {
        include: { tenant: { select: { name: true } } },
      },
    },
  });

  return <UserManagement users={users} />;
}
