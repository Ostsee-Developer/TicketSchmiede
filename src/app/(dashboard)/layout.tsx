import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getLatestUserRole, isEmployeePortalRole } from "@/lib/access-role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isSuperAdmin) {
    const role = await getLatestUserRole(session.user.id);
    if (isEmployeePortalRole(role)) {
      redirect("/portal/tickets");
    }
  }

  return (
    <AppShell
      sidebarProps={{
        isSuperAdmin: session.user.isSuperAdmin,
        userName: session.user.name ?? undefined,
        userEmail: session.user.email ?? undefined,
        userImage: session.user.image ?? undefined,
      }}
    >
      {children}
    </AppShell>
  );
}
