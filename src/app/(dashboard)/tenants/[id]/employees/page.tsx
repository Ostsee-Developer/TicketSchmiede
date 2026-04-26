import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Mitarbeiter` };
}

const statusBadge = (status: string) => ({
  ACTIVE: "bg-green-100 text-green-700",
  DISABLED: "bg-gray-100 text-gray-500",
  LEFT: "bg-red-100 text-red-600",
}[status] ?? "bg-gray-100 text-gray-600");

const statusLabel = (s: string) => ({ ACTIVE: "Aktiv", DISABLED: "Deaktiviert", LEFT: "Ausgeschieden" }[s] ?? s);

export default async function TenantEmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const where = {
    tenantId: id,
    ...(sp.status ? { status: sp.status as "ACTIVE" } : {}),
    ...(sp.search
      ? {
          OR: [
            { firstName: { contains: sp.search, mode: "insensitive" as const } },
            { lastName: { contains: sp.search, mode: "insensitive" as const } },
            { email: { contains: sp.search, mode: "insensitive" as const } },
            { department: { contains: sp.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      location: { select: { name: true } },
      workstation: { select: { name: true } },
      _count: { select: { devices: true, credentials: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/tenants/${id}/dashboard`} className="hover:text-blue-600">{tenant.name}</Link>
            <span>/</span>
            <span>Mitarbeiter</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Mitarbeiter</h1>
          <p className="text-gray-400 text-sm">{employees.length} Einträge</p>
        </div>
        <Link
          href={`/tenants/${id}/employees/new`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Mitarbeiter
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Alle", status: undefined },
          { label: "Aktiv", status: "ACTIVE" },
          { label: "Deaktiviert", status: "DISABLED" },
          { label: "Ausgeschieden", status: "LEFT" },
        ].map((f) => (
          <Link
            key={f.label}
            href={`/tenants/${id}/employees${f.status ? `?status=${f.status}` : ""}`}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sp.status === f.status || (!sp.status && !f.status)
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Position / Abteilung</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">E-Mail</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Standort</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Arbeitsplatz</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Geräte</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Keine Mitarbeiter gefunden</td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {e.firstName[0]}{e.lastName[0]}
                    </div>
                    <span className="font-medium text-gray-900">
                      {e.lastName}, {e.firstName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {[e.position, e.department].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{e.email ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.location?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.workstation?.name ?? "—"}</td>
                <td className="px-4 py-3 text-center text-gray-500">{e._count.devices}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(e.status)}`}>
                    {statusLabel(e.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/tenants/${id}/employees/${e.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Details →
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
