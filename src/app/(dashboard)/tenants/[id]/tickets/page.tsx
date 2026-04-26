import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Tickets` };
}

export default async function TenantTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; priority?: string }>;
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
    ...(sp.status ? { status: sp.status as "NEW" } : {}),
    ...(sp.priority ? { priority: sp.priority as "LOW" } : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: {
      employee: { select: { firstName: true, lastName: true } },
      technician: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });

  const priorityColor = (p: string) => ({
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
    LOW: "bg-gray-100 text-gray-600 border-gray-200",
  }[p] ?? "bg-gray-100");

  const statusLabel = (s: string) => ({
    NEW: "Neu", IN_PROGRESS: "In Bearbeitung",
    WAITING_FOR_CUSTOMER: "Wartet", RESOLVED: "Gelöst", CLOSED: "Geschlossen",
  }[s] ?? s);

  const statusColor = (s: string) => ({
    NEW: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
  }[s] ?? "");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/tenants/${id}/dashboard`} className="hover:text-blue-600">{tenant.name}</Link>
            <span>/</span>
            <span>Tickets</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        </div>
        <Link
          href={`/tenants/${id}/tickets/new`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Alle", params: {} },
          { label: "Neu", params: { status: "NEW" } },
          { label: "In Bearbeitung", params: { status: "IN_PROGRESS" } },
          { label: "Kritisch", params: { priority: "CRITICAL" } },
        ].map((f) => {
          const isActive = JSON.stringify(f.params) === JSON.stringify(sp);
          return (
            <Link
              key={f.label}
              href={`/tenants/${id}/tickets?${new URLSearchParams(f.params).toString()}`}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-16">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Titel</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Mitarbeiter</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Priorität</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Techniker</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Erstellt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Keine Tickets gefunden
                </td>
              </tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-400 text-xs">#{t.number}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/tenants/${id}/tickets/${t.id}`}
                    className="font-medium text-gray-900 hover:text-blue-700 transition-colors"
                  >
                    {t.title}
                  </Link>
                  {t._count.comments > 0 && (
                    <span className="ml-2 text-xs text-gray-400">({t._count.comments} Kommentare)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {t.employee
                    ? `${t.employee.firstName} ${t.employee.lastName}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priorityColor(t.priority)}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {t.technician?.name ?? <span className="text-gray-300">Nicht zugewiesen</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
