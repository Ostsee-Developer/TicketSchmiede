import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Mandanten" };

export default async function TenantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          employees: true,
          tickets: { where: { status: { notIn: ["RESOLVED", "CLOSED"] } } },
          devices: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mandanten</h1>
          <p className="text-gray-500 mt-1">{tenants.length} Mandanten gesamt</p>
        </div>
        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Mandant
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Slug</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Mitarbeiter</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Geräte</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Offene Tickets</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-sm">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3 text-center text-gray-700">{t._count.employees}</td>
                <td className="px-4 py-3 text-center text-gray-700">{t._count.devices}</td>
                <td className="px-4 py-3 text-center">
                  {t._count.tickets > 0 ? (
                    <span className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {t._count.tickets}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {t.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/tenants/${t.id}/dashboard`}
                    className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                  >
                    Öffnen →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
