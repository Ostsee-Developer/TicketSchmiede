import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPortalContext } from "@/lib/portal-context";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { TicketSearchBar } from "@/components/portal/ticket-search-bar";

export const metadata = { title: "Meine Tickets – TicketSchmiede" };

const STATUS_META: Record<string, { label: string; className: string }> = {
  NEW:                    { label: "Neu",                className: "bg-blue-100 text-blue-700 ring-blue-200" },
  IN_PROGRESS:            { label: "In Bearbeitung",    className: "bg-purple-100 text-purple-700 ring-purple-200" },
  WAITING_FOR_CUSTOMER:   { label: "Warte auf dich",    className: "bg-amber-100 text-amber-700 ring-amber-200" },
  RESOLVED:               { label: "Gelöst",             className: "bg-green-100 text-green-700 ring-green-200" },
  CLOSED:                 { label: "Geschlossen",        className: "bg-gray-100 text-gray-500 ring-gray-200" },
};

const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  LOW:      { label: "Niedrig",  dot: "bg-gray-400" },
  MEDIUM:   { label: "Normal",   dot: "bg-blue-500" },
  HIGH:     { label: "Hoch",     dot: "bg-orange-500" },
  CRITICAL: { label: "Kritisch", dot: "bg-red-500" },
};

interface SearchParams {
  status?: string;
  search?: string;
}

export default async function PortalTicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");

  const { status, search } = await searchParams;
  const canViewAll = can.viewAllTenantTickets(ctx.role);

  const where = {
    tenantId: ctx.tenantId,
    ...(canViewAll ? {} : { createdById: ctx.userId }),
    ...(status && status !== "ALL" ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      employee: { select: { firstName: true, lastName: true } },
      createdBy: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });

  const openCount = tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {canViewAll ? "Alle Tickets" : "Meine Tickets"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {openCount > 0
              ? `${openCount} offen${tickets.length > openCount ? ` · ${tickets.length - openCount} abgeschlossen` : ""}`
              : tickets.length === 0
              ? "Noch keine Tickets"
              : "Alle Tickets abgeschlossen"}
          </p>
        </div>
        <Link
          href="/portal/tickets/new"
          className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Ticket
        </Link>
      </div>

      {/* Search + Filter */}
      <TicketSearchBar currentStatus={status} currentSearch={search} />

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <EmptyState hasFilters={!!(status || search)} />
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => {
            const statusMeta = STATUS_META[t.status] ?? { label: t.status, className: "bg-gray-100 text-gray-600 ring-gray-200" };
            const priorityMeta = PRIORITY_META[t.priority] ?? { label: t.priority, dot: "bg-gray-400" };
            const isResolved = ["RESOLVED", "CLOSED"].includes(t.status);

            return (
              <Link
                key={t.id}
                href={`/portal/tickets/${t.id}`}
                className={`block bg-white rounded-xl border transition-all hover:shadow-md hover:border-blue-200 ${
                  isResolved ? "border-gray-100 opacity-75" : "border-gray-200"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Priority dot */}
                    <div className="mt-1.5 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${priorityMeta.dot}`} title={priorityMeta.label} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400 shrink-0">#{t.number}</span>
                        <span className="font-semibold text-gray-900 truncate">{t.title}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {t.employee && (
                          <span>
                            {t.employee.firstName} {t.employee.lastName}
                          </span>
                        )}
                        {canViewAll && t.createdBy && (
                          <span className="text-gray-400">von {t.createdBy.name}</span>
                        )}
                        <span className="text-gray-400">{formatDateTime(t.createdAt)}</span>
                        {t._count.comments > 0 && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {t._count.comments}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ring-1 ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      {hasFilters ? (
        <>
          <p className="text-gray-700 font-medium">Keine Tickets gefunden</p>
          <p className="text-sm text-gray-500 mt-1">Versuche einen anderen Filter oder Suchbegriff.</p>
          <Link href="/portal/tickets" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Filter zurücksetzen
          </Link>
        </>
      ) : (
        <>
          <p className="text-gray-700 font-medium">Noch keine Support-Tickets</p>
          <p className="text-sm text-gray-500 mt-1">Erstelle dein erstes Ticket – wir helfen dir schnell.</p>
          <Link
            href="/portal/tickets/new"
            className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ticket erstellen
          </Link>
        </>
      )}
    </div>
  );
}
