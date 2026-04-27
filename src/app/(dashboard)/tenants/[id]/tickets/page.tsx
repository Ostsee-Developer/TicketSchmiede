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

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
};
const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: "Kritisch", HIGH: "Hoch", MEDIUM: "Mittel", LOW: "Niedrig",
};
const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<string, string> = {
  NEW: "Neu", IN_PROGRESS: "In Bearbeitung",
  WAITING_FOR_CUSTOMER: "Wartet", RESOLVED: "Gelöst", CLOSED: "Geschlossen",
};

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

  const filters = [
    { label: "Alle", params: {} },
    { label: "Neu", params: { status: "NEW" } },
    { label: "In Bearbeitung", params: { status: "IN_PROGRESS" } },
    { label: "Kritisch", params: { priority: "CRITICAL" } },
  ] as { label: string; params: Record<string, string> }[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
            <Link href={`/tenants/${id}/dashboard`} className="hover:text-blue-600 truncate max-w-[140px]">
              {tenant.name}
            </Link>
            <span>/</span>
            <span>Tickets</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        </div>
        <Link
          href={`/tenants/${id}/tickets/new`}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Ticket
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => {
          const isActive = JSON.stringify(f.params) === JSON.stringify(sp);
          return (
            <Link
              key={f.label}
              href={`/tenants/${id}/tickets?${new URLSearchParams(f.params).toString()}`}
              className={`text-sm px-3.5 py-1.5 rounded-xl font-medium transition-colors ${
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

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-medium text-gray-500">Keine Tickets gefunden</p>
        </div>
      ) : (
        <>
          {/* ── Desktop: Tabelle ── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 w-14">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Titel</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Mitarbeiter</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Priorität</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Techniker</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden xl:table-cell">Erstellt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 font-mono text-gray-400 text-xs">#{t.number}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tenants/${id}/tickets/${t.id}`}
                          className="font-medium text-gray-900 hover:text-blue-700 transition-colors group-hover:underline"
                        >
                          {t.title}
                        </Link>
                        {t._count.comments > 0 && (
                          <span className="ml-2 text-xs text-gray-400">({t._count.comments})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs hidden lg:table-cell">
                        {t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                          {PRIORITY_LABEL[t.priority] ?? t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status] ?? ""}`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {t.technician?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile: Cards ── */}
          <div className="grid gap-3 md:hidden">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tenants/${id}/tickets/${t.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm active:scale-[.99] transition-all"
              >
                {/* Top row: number + status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-gray-400 font-medium">#{t.number}</span>
                  <div className="flex items-center gap-1.5">
                    {t._count.comments > 0 && (
                      <span className="text-2xs text-gray-400 flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {t._count.comments}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status] ?? ""}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <p className="font-semibold text-gray-900 leading-snug mb-3">{t.title}</p>

                {/* Meta row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_COLOR[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {PRIORITY_LABEL[t.priority] ?? t.priority}
                    </span>
                    {t.employee && (
                      <span className="text-xs text-gray-500 truncate">
                        {t.employee.firstName} {t.employee.lastName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.technician ? (
                      <span className="text-xs text-gray-400 truncate max-w-[100px]">{t.technician.name}</span>
                    ) : (
                      <span className="text-xs text-gray-300">Nicht zugewiesen</span>
                    )}
                    <span className="text-xs text-gray-300">{formatDate(t.createdAt)}</span>
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
