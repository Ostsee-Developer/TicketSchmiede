import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLatestUserRole, isEmployeePortalRole } from "@/lib/access-role";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.isSuperAdmin) redirect("/dashboard");

  const userRole = await getLatestUserRole(session.user.id);
  if (!userRole) redirect("/login");

  if (isEmployeePortalRole(userRole)) {
    redirect("/portal/tickets");
  }

  redirect("/dashboard");
}
