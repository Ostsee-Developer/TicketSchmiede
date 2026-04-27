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
    where: { deletedAt: null },
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mandanten</h1>
          <p className="text-gray-500 mt-1">{tenants.length} Mandant{tenants.length !== 1 ? "en" : ""} gesamt</p>
        </div>
        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Mandant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="font-medium">Noch keine Mandanten angelegt.</p>
          <p className="text-sm mt-1">Erstelle deinen ersten Mandanten mit &bdquo;Neuer Mandant&ldquo;.</p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Slug</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Mitarbeiter</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 hidden lg:table-cell">Geräte</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Tickets</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden lg:table-cell">{t.slug}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{t._count.employees}</td>
                      <td className="px-4 py-3 text-center text-gray-700 hidden lg:table-cell">{t._count.devices}</td>
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

          {/* Mobile: card list */}
          <div className="grid gap-3 md:hidden">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/tenants/${t.id}/dashboard`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all block"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-base shrink-0">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{t.slug}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {t.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg font-bold text-gray-900">{t._count.employees}</p>
                    <p className="text-2xs text-gray-500">Mitarbeiter</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg font-bold text-gray-900">{t._count.devices}</p>
                    <p className="text-2xs text-gray-500">Geräte</p>
                  </div>
                  <div className={`rounded-lg py-2 ${t._count.tickets > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                    <p className={`text-lg font-bold ${t._count.tickets > 0 ? "text-orange-600" : "text-gray-900"}`}>
                      {t._count.tickets}
                    </p>
                    <p className="text-2xs text-gray-500">Tickets</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
