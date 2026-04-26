import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Benutzer & Rechte" };

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INTERNAL_ADMIN: "Interner Admin",
  TECHNICIAN: "Techniker",
  CUSTOMER_ADMIN: "Kunden-Admin",
  CUSTOMER_USER: "Kunden-Benutzer",
  READ_ONLY: "Nur Lesen",
};

const roleBadge: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  INTERNAL_ADMIN: "bg-blue-100 text-blue-700",
  TECHNICIAN: "bg-purple-100 text-purple-700",
  CUSTOMER_ADMIN: "bg-green-100 text-green-700",
  CUSTOMER_USER: "bg-gray-100 text-gray-600",
  READ_ONLY: "bg-yellow-100 text-yellow-700",
};

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benutzer & Rechte</h1>
          <p className="text-gray-500 mt-1">{users.length} Benutzer</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Benutzer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Benutzer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Rollen / Mandanten</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">2FA</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Letzter Login</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.isSuperAdmin && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge.SUPER_ADMIN}`}>
                        Super Admin
                      </span>
                    )}
                    {u.tenantRoles.map((tr) => (
                      <span key={tr.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[tr.role] ?? ""}`}>
                        {roleLabel[tr.role] ?? tr.role} @ {tr.tenant.name}
                      </span>
                    ))}
                    {!u.isSuperAdmin && u.tenantRoles.length === 0 && (
                      <span className="text-xs text-gray-400">Keine Rollen</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {u.twoFactorEnabled ? (
                    <span className="text-green-600 text-xs font-medium">Aktiv</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Noch nie"}
                </td>
                <td className="px-4 py-3 text-center">
                  {u.lockedUntil && u.lockedUntil > new Date() ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Gesperrt</span>
                  ) : u.isActive ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Aktiv</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inaktiv</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-gray-400 hover:text-blue-600 text-xs font-medium">
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
