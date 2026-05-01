import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.isSuperAdmin) redirect("/dashboard");

  const userRole = await prisma.userTenantRole.findFirst({
    where: { userId: session.user.id },
    select: { role: true },
    orderBy: { createdAt: "desc" },
  });

  if (!userRole) redirect("/login");

  // Neues Zielbild:
  // - Mitarbeiter (CUSTOMER_USER) => eigenes Ticket-Portal
  // - alle übrigen Rollen => Dashboard
  if (userRole.role === Role.CUSTOMER_USER) {
    redirect("/portal/tickets");
  }

  redirect("/dashboard");
}
