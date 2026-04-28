import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPortalContext } from "@/lib/portal-context";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { TicketReplyForm } from "@/components/portal/ticket-reply-form";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; className: string }> = {
  NEW:                    { label: "Neu",              className: "bg-blue-100 text-blue-700 ring-blue-200" },
  IN_PROGRESS:            { label: "In Bearbeitung",  className: "bg-purple-100 text-purple-700 ring-purple-200" },
  WAITING_FOR_CUSTOMER:   { label: "Warte auf dich",  className: "bg-amber-100 text-amber-700 ring-amber-200" },
  RESOLVED:               { label: "Gelöst",           className: "bg-green-100 text-green-700 ring-green-200" },
  CLOSED:                 { label: "Geschlossen",      className: "bg-gray-100 text-gray-500 ring-gray-200" },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  LOW:      { label: "Niedrig",  className: "text-gray-600" },
  MEDIUM:   { label: "Normal",   className: "text-blue-600" },
  HIGH:     { label: "Hoch",     className: "text-orange-600" },
  CRITICAL: { label: "Kritisch", className: "text-red-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  HARDWARE: "Hardware", SOFTWARE: "Software", EMAIL: "E-Mail",
  NETWORK: "Netzwerk", USER_ACCOUNT: "Benutzerkonto", PRINTER: "Drucker / Scanner",
  PHONE: "Telefon", VPN: "VPN / Fernzugang", OTHER: "Sonstiges",
};

export default async function PortalTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      createdBy: { select: { id: true, name: true } },
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
      files: {
        select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
      },
    },
  });

  if (!ticket || ticket.tenantId !== ctx.tenantId) notFound();

  // CUSTOMER_USER can only view their own tickets
  if (!can.viewAllTenantTickets(ctx.role) && ticket.createdById !== ctx.userId) {
    notFound();
  }

  const statusMeta = STATUS_META[ticket.status] ?? { label: ticket.status, className: "bg-gray-100 text-gray-600 ring-gray-200" };
  const priorityMeta = PRIORITY_META[ticket.priority] ?? { label: ticket.priority, className: "text-gray-600" };
  const isClosed = ["RESOLVED", "CLOSED"].includes(ticket.status);

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back */}
      <Link
        href="/portal/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Alle Tickets
      </Link>

      {/* Ticket header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-gray-400">#{ticket.number}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ring-1 ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 leading-snug">{ticket.title}</h1>
          </div>
        </div>

        {/* Meta grid */}
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaItem label="Kategorie" value={CATEGORY_LABELS[ticket.category] ?? ticket.category} />
          <MetaItem
            label="Dringlichkeit"
            value={<span className={`font-medium ${priorityMeta.className}`}>{priorityMeta.label}</span>}
          />
          <MetaItem label="Erstellt" value={formatDateTime(ticket.createdAt)} />
          <MetaItem label="Aktualisiert" value={formatDateTime(ticket.updatedAt)} />
          {ticket.employee && (
            <MetaItem
              label="Mitarbeiter"
              value={`${ticket.employee.firstName} ${ticket.employee.lastName}`}
            />
          )}
          <MetaItem label="Gemeldet von" value={ticket.createdBy.name} />
        </dl>

        {/* Original description */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Problembeschreibung</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
        </div>

        {/* Files attached to ticket */}
        {ticket.files.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Anhänge</p>
            <div className="flex flex-wrap gap-2">
              {ticket.files.map((f) => (
                <div key={f.id} className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-gray-700 max-w-[120px] truncate">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Chat / Comment timeline ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Verlauf</h2>

        {ticket.comments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <svg className="w-8 h-8 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-gray-500">Noch keine Nachrichten. Wir melden uns bald!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ticket.comments.map((comment) => {
              const isOwnMessage = comment.user.id === ctx.userId;
              return (
                <div
                  key={comment.id}
                  className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    isOwnMessage ? "bg-blue-600" : "bg-gray-400"
                  }`}>
                    {comment.user.name?.slice(0, 2).toUpperCase() ?? "?"}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[80%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${
                      isOwnMessage
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                    </div>
                    <div className={`flex items-center gap-2 px-1 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                      <span className="text-xs text-gray-400">{comment.user.name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Reply form ── */}
      {!isClosed ? (
        <TicketReplyForm ticketId={ticket.id} />
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500">
            Dieses Ticket ist {ticket.status === "RESOLVED" ? "gelöst" : "geschlossen"}.{" "}
            <Link href="/portal/tickets/new" className="text-blue-600 hover:underline">
              Neues Ticket erstellen
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800 font-medium mt-0.5 truncate">{value}</dd>
    </div>
  );
}
