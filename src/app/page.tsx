import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.isSuperAdmin) redirect("/dashboard");

  // Determine where to send the user based on their role
  const userRole = await prisma.userTenantRole.findFirst({
    where: { userId: session.user.id },
    select: { role: true },
    orderBy: { createdAt: "desc" },
  });

  if (!userRole) redirect("/login");

  const customerRoles: Role[] = [Role.CUSTOMER_ADMIN, Role.CUSTOMER_USER];
  if (customerRoles.includes(userRole.role)) {
    redirect("/portal/tickets");
  }

  redirect("/dashboard");
}
