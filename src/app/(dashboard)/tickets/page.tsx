import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Alle Tickets" };

const statusLabel: Record<string, string> = {
  NEW: "Neu",
  IN_PROGRESS: "In Bearbeitung",
  WAITING_FOR_CUSTOMER: "Wartet auf Kunde",
  RESOLVED: "Gelöst",
  CLOSED: "Geschlossen",
};

const statusColor: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  WAITING_FOR_CUSTOMER: "bg-orange-100 text-orange-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

const priorityColor: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const priorityLabel: Record<string, string> = {
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
    <div className="space-y-6">
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
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-400">Keine offenen Tickets</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Mandant</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Priorität</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Zuständig</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Erstellt</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 line-clamp-1">{ticket.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ticket.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tenants/${ticket.tenant.id}/dashboard`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                    >
                      {ticket.tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor[ticket.priority] ?? ""}`}>
                      {priorityLabel[ticket.priority] ?? ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[ticket.status] ?? ""}`}>
                      {statusLabel[ticket.status] ?? ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {ticket.technician?.name ?? <span className="text-gray-300">Nicht zugewiesen</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {formatDateTime(ticket.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenants/${ticket.tenant.id}/tickets/${ticket.id}`}
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
      )}
    </div>
  );
}
