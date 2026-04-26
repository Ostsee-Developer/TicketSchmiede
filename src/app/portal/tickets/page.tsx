import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Meine Tickets" };

const statusLabel: Record<string, string> = {
  NEW: "Neu",
  IN_PROGRESS: "In Bearbeitung",
  WAITING_FOR_CUSTOMER: "Warte auf Rückmeldung",
  RESOLVED: "Gelöst",
  CLOSED: "Geschlossen",
};

const statusColor: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default async function PortalTicketsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tickets = await prisma.ticket.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      _count: { select: { comments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine Support-Tickets</h1>
          <p className="text-gray-500 mt-1">Hallo, {session.user.name}</p>
        </div>
        <Link
          href="/portal/tickets/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 mb-3">Sie haben noch keine Support-Tickets erstellt.</p>
          <Link
            href="/portal/tickets/new"
            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            Jetzt erstes Ticket erstellen →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/portal/tickets/${t.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">#{t.number}</span>
                    <span className="font-semibold text-gray-900 truncate">{t.title}</span>
                  </div>
                  {t.employee && (
                    <p className="text-xs text-gray-500">
                      Betroffener Mitarbeiter: {t.employee.firstName} {t.employee.lastName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(t.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.status] ?? ""}`}>
                    {statusLabel[t.status] ?? t.status}
                  </span>
                  {t._count.comments > 0 && (
                    <span className="text-xs text-gray-400">{t._count.comments} Nachrichten</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
