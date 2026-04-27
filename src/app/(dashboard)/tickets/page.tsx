import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Alle Tickets" };

const STATUS_LABEL: Record<string, string> = {
  NEW: "Neu",
  IN_PROGRESS: "In Bearbeitung",
  WAITING_FOR_CUSTOMER: "Wartet auf Kunde",
  RESOLVED: "Gelöst",
  CLOSED: "Geschlossen",
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  WAITING_FOR_CUSTOMER: "bg-orange-100 text-orange-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  CRITICAL: "Kritisch",
};

export default async function TicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let tickets;

  if (session.user.isSuperAdmin) {
    tickets = await prisma.ticket.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
        technician: { select: { name: true } },
      },
    });
  } else {
    const userRoles = await prisma.userTenantRole.findMany({
      where: { userId: session.user.id },
      select: { tenantId: true },
    });
    const tenantIds = userRoles.map((r) => r.tenantId);

    tickets = await prisma.ticket.findMany({
      where: {
        tenantId: { in: tenantIds },
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
        technician: { select: { name: true } },
      },
    });
  }

  const critical = tickets.filter((t) => t.priority === "CRITICAL").length;
  const open = tickets.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alle Tickets</h1>
          <p className="text-gray-500 mt-1">
            {open} offene Tickets
            {critical > 0 && (
              <span className="ml-2 text-red-600 font-semibold">· {critical} kritisch</span>
            )}
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-medium text-gray-500">Keine offenen Tickets</p>
        </div>
      ) : (
        <>
          {/* ── Desktop: Tabelle ── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Mandant</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Priorität</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Zuständig</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden xl:table-cell">Erstellt</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 line-clamp-1">{ticket.title}</p>
                        {ticket.category && (
                          <p className="text-xs text-gray-400 mt-0.5">{ticket.category}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Link
                          href={`/tenants/${ticket.tenant.id}/dashboard`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                        >
                          {ticket.tenant.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}>
                          {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status] ?? ""}`}>
                          {STATUS_LABEL[ticket.status] ?? ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                        {ticket.technician?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden xl:table-cell">
                        {formatDateTime(ticket.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/tenants/${ticket.tenant.id}/tickets/${ticket.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs group-hover:underline"
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

          {/* ── Mobile: Cards ── */}
          <div className="grid gap-3 md:hidden">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tenants/${ticket.tenant.id}/tickets/${ticket.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm active:scale-[.99] transition-all"
              >
                {/* Top row: number + status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {ticket.number != null && (
                      <span className="font-mono text-xs text-gray-400 font-medium shrink-0">#{ticket.number}</span>
                    )}
                    <span className="text-xs text-blue-600 font-medium truncate">{ticket.tenant.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[ticket.status] ?? ""}`}>
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </span>
                </div>

                {/* Title */}
                <p className="font-semibold text-gray-900 leading-snug mb-3">{ticket.title}</p>

                {/* Meta row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_COLOR[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
                    </span>
                    {ticket.category && (
                      <span className="text-xs text-gray-400 truncate">{ticket.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.technician ? (
                      <span className="text-xs text-gray-400 truncate max-w-[100px]">{ticket.technician.name}</span>
                    ) : (
                      <span className="text-xs text-gray-300">Nicht zugewiesen</span>
                    )}
                    <span className="text-xs text-gray-300">{formatDateTime(ticket.createdAt)}</span>
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
