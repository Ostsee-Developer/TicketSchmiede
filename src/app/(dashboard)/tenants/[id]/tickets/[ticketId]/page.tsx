"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  timeSpent: number | null;
  internalNotes: string | null;
  createdAt: string;
  employee: { firstName: string; lastName: string } | null;
  technician: { id: string; name: string } | null;
  createdBy: { name: string };
  device: { type: string; manufacturer: string; model: string } | null;
  workstation: { name: string } | null;
  comments: Array<{
    id: string;
    content: string;
    isInternal: boolean;
    timeSpent: number | null;
    createdAt: string;
    user: { name: string };
  }>;
}

const statusOptions = [
  { value: "NEW", label: "Neu" },
  { value: "IN_PROGRESS", label: "In Bearbeitung" },
  { value: "WAITING_FOR_CUSTOMER", label: "Wartet auf Kunden" },
  { value: "RESOLVED", label: "Gelöst" },
  { value: "CLOSED", label: "Geschlossen" },
];

const priorityOptions = [
  { value: "LOW", label: "Niedrig" },
  { value: "MEDIUM", label: "Normal" },
  { value: "HIGH", label: "Hoch" },
  { value: "CRITICAL", label: "Kritisch" },
];

export default function TicketDetailPage() {
  const params = useParams<{ id: string; ticketId: string }>();
  const { id: tenantId, ticketId } = params;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [timeSpent, setTimeSpent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/tickets/${ticketId}`)
      .then((r) => r.json())
      .then((d) => { setTicket(d.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const d = await res.json();
      setTicket((t) => t ? { ...t, status: d.data.status } : t);
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: comment,
        isInternal,
        timeSpent: timeSpent ? Number(timeSpent) : undefined,
      }),
    });
    if (res.ok) {
      setComment("");
      setTimeSpent("");
      load();
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!ticket) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
      <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-gray-500 font-medium">Ticket nicht gefunden.</p>
      <Link href={`/tenants/${tenantId}/tickets`} className="text-blue-600 text-sm hover:underline">← Zurück zur Ticketliste</Link>
    </div>
  );

  const statusColor: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
        <Link href={`/tenants/${tenantId}/tickets`} className="hover:text-blue-600 shrink-0">Tickets</Link>
        <span>/</span>
        <span className="truncate">#{ticket.number} · {ticket.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[ticket.status] ?? ""}`}>
                {statusOptions.find((s) => s.value === ticket.status)?.label}
              </span>
            </div>
            {ticket.description ? (
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            ) : (
              <p className="text-gray-400 italic text-sm">Keine Beschreibung vorhanden.</p>
            )}
          </div>

          {/* Internal Notes */}
          {ticket.internalNotes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-bold text-yellow-700 mb-1">Interne Notizen</p>
              <p className="text-sm text-yellow-900 whitespace-pre-wrap">{ticket.internalNotes}</p>
            </div>
          )}

          {/* Comments */}
          <div className="space-y-3">
            {ticket.comments.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-4 ${c.isInternal ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-800">{c.user.name}</span>
                  <div className="flex items-center gap-2">
                    {c.isInternal && (
                      <span className="text-xs bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-medium">Intern</span>
                    )}
                    {c.timeSpent && <span className="text-xs text-gray-400">{c.timeSpent}min</span>}
                    <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Antwort hinzufügen</h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Deine Nachricht..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm leading-relaxed"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
              <div className="flex items-center gap-4 flex-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-gray-600">Interne Notiz</span>
                </label>
                <input
                  type="number"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  placeholder="Zeit (min)"
                  className="w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={submitComment}
                disabled={submitting || !comment.trim()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Senden…" : "Senden"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Status ändern</h3>
            <div className="space-y-1.5">
              {statusOptions.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateStatus(s.value)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                    ticket.status === s.value
                      ? "bg-blue-600 text-white font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-gray-800">Details</h3>
            <div>
              <span className="text-gray-400 text-xs block">Priorität</span>
              <span className="font-medium text-gray-800">
                {priorityOptions.find((p) => p.value === ticket.priority)?.label}
              </span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">Erstellt von</span>
              <span className="text-gray-800">{ticket.createdBy.name}</span>
            </div>
            {ticket.technician && (
              <div>
                <span className="text-gray-400 text-xs block">Zuständig</span>
                <span className="text-gray-800">{ticket.technician.name}</span>
              </div>
            )}
            {ticket.employee && (
              <div>
                <span className="text-gray-400 text-xs block">Betroffener Mitarbeiter</span>
                <span className="text-gray-800">{ticket.employee.firstName} {ticket.employee.lastName}</span>
              </div>
            )}
            {ticket.timeSpent && (
              <div>
                <span className="text-gray-400 text-xs block">Zeitaufwand</span>
                <span className="text-gray-800">{ticket.timeSpent} min</span>
              </div>
            )}
            <div>
              <span className="text-gray-400 text-xs block">Erstellt</span>
              <span className="text-gray-800 text-xs">{formatDateTime(ticket.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
