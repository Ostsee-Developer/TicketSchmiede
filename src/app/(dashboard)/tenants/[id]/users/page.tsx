import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { hasMinRole } from "@/lib/permissions";
import { TenantPasskeyManagement } from "./TenantPasskeyManagement";

export const metadata = { title: "Benutzer-Passkeys" };

export default async function TenantUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!hasMinRole(ctx.role, Role.TECHNICIAN)) redirect(`/tenants/${id}/dashboard`);

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  if (!tenant) notFound();

  const users = await prisma.user.findMany({
    where: { tenantRoles: { some: { tenantId: id } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      passkeys: { select: { id: true, name: true, createdAt: true, lastUsedAt: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/dashboard`} className="text-gray-400 hover:text-gray-600">
          Zurück
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benutzer-Passkeys</h1>
          <p className="text-sm text-gray-500">{tenant.name}: Passkeys erstellen, zurücksetzen oder per E-Mail resetten.</p>
        </div>
      </div>
      <TenantPasskeyManagement tenantId={id} initialUsers={users} />
    </div>
  );
}
