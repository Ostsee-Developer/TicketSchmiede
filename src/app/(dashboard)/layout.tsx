import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      sidebarProps={{
        isSuperAdmin: session.user.isSuperAdmin,
        userName: session.user.name ?? undefined,
        userEmail: session.user.email ?? undefined,
      }}
    >
      {children}
    </AppShell>
  );
}
