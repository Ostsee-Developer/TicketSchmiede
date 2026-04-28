import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPortalContext } from "@/lib/portal-context";

export const metadata = { title: "Mitarbeiter – TicketSchmiede" };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:   "Aktiv",
  DISABLED: "Inaktiv",
  LEFT:     "Ausgeschieden",
};

export default async function PortalEmployeesPage() {
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");
  if (!ctx.isCustomerAdmin) notFound();

  const employees = await prisma.employee.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      department: true,
      position: true,
      status: true,
      location: { select: { name: true } },
    },
  });

  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mitarbeiter</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {activeCount} aktiv · {employees.length} gesamt
        </p>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-14 text-center">
          <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500">Noch keine Mitarbeiter angelegt</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Abteilung</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Standort</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {e.firstName[0]}{e.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{e.firstName} {e.lastName}</p>
                          {e.email && <p className="text-xs text-gray-500">{e.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <p>{e.department ?? "—"}</p>
                      {e.position && <p className="text-xs text-gray-500">{e.position}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{e.location?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        e.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2.5">
            {employees.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                      {e.firstName[0]}{e.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{e.firstName} {e.lastName}</p>
                      {e.email && <p className="text-xs text-gray-500 truncate">{e.email}</p>}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                    e.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : e.status === "ON_LEAVE"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {STATUS_LABELS[e.status] ?? e.status}
                  </span>
                </div>

                {(e.department || e.location) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                    {e.department && <span>{e.department}{e.position ? ` · ${e.position}` : ""}</span>}
                    {e.location && <span>{e.location.name}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
