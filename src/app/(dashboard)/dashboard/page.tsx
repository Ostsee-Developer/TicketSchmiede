import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTenants } from "@/lib/tenant";
import Link from "next/link";
import {
  Ticket,
  AlertTriangle,
  Building2,
  ShieldAlert,
  Clock,
  ArrowRight,
  Plus,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Dashboard – Ticket Schmiede" };

const priorityConfig = {
  LOW: { label: "Niedrig", variant: "muted" as const },
  MEDIUM: { label: "Mittel", variant: "info" as const },
  HIGH: { label: "Hoch", variant: "warning" as const },
  CRITICAL: { label: "Kritisch", variant: "destructive" as const },
};

const statusConfig = {
  NEW: { label: "Neu", variant: "info" as const },
  IN_PROGRESS: { label: "In Bearbeitung", variant: "warning" as const },
  WAITING_FOR_CUSTOMER: { label: "Wartet", variant: "muted" as const },
  RESOLVED: { label: "Gelöst", variant: "success" as const },
  CLOSED: { label: "Geschlossen", variant: "muted" as const },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    tenants,
    openTickets,
    criticalTickets,
    activeTenants,
    expiringWarranties,
    expiringSoftware,
    recentTickets,
    recentAuditLogs,
  ] = await Promise.all([
    getUserTenants(session.user.id, session.user.isSuperAdmin),
    prisma.ticket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count({
      where: { priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.device.count({
      where: { warrantyUntil: { gte: now, lte: in90Days }, status: "ACTIVE" },
    }),
    prisma.software.count({
      where: { validUntil: { gte: now, lte: in30Days } },
    }),
    prisma.ticket.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        tenant: { select: { name: true, id: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const hasWarnings = criticalTickets > 0 || expiringWarranties > 0 || expiringSoftware > 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Willkommen zurück, {session.user.name} — {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {session.user.isSuperAdmin && (
          <Link
            href="/tenants/new"
            className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Neuer Mandant
          </Link>
        )}
      </div>

      {/* ── Warning Banner ── */}
      {hasWarnings && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm mb-1">Handlungsbedarf</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {criticalTickets > 0 && (
                <Link href="/tickets?priority=CRITICAL" className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2">
                  {criticalTickets} kritische{criticalTickets === 1 ? "s" : ""} Ticket{criticalTickets !== 1 ? "s" : ""}
                </Link>
              )}
              {expiringWarranties > 0 && (
                <span className="text-xs text-amber-700">
                  {expiringWarranties} Garantie{expiringWarranties !== 1 ? "n" : ""} ablaufend (90 Tage)
                </span>
              )}
              {expiringSoftware > 0 && (
                <span className="text-xs text-amber-700">
                  {expiringSoftware} Software-Lizenz{expiringSoftware !== 1 ? "en" : ""} ablaufend (30 Tage)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Offene Tickets"
          value={openTickets}
          icon={<Ticket className="w-5 h-5" />}
          href="/tickets"
          variant="info"
          subtitle="nicht abgeschlossen"
        />
        <StatCard
          title="Kritische Tickets"
          value={criticalTickets}
          icon={<ShieldAlert className="w-5 h-5" />}
          href="/tickets?priority=CRITICAL"
          variant={criticalTickets > 0 ? "danger" : "default"}
          subtitle="sofortiger Handlungsbedarf"
        />
        <StatCard
          title="Aktive Mandanten"
          value={activeTenants}
          icon={<Building2 className="w-5 h-5" />}
          href="/tenants"
          variant="success"
          subtitle="Kunden in Betreuung"
        />
        <StatCard
          title="Garantien ablaufend"
          value={expiringWarranties}
          icon={<Clock className="w-5 h-5" />}
          variant={expiringWarranties > 0 ? "warning" : "default"}
          subtitle="innerhalb 90 Tage"
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Tickets */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground text-sm">Offene Tickets</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{openTickets} gesamt</p>
            </div>
            <Link
              href="/tickets"
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Alle anzeigen
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTickets.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine offenen Tickets</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTickets.map((ticket) => {
                const p = priorityConfig[ticket.priority as keyof typeof priorityConfig];
                const s = statusConfig[ticket.status as keyof typeof statusConfig];
                return (
                  <Link
                    key={ticket.id}
                    href={`/tenants/${ticket.tenantId}/tickets/${ticket.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          #{ticket.ticketNumber}
                        </span>
                        <Badge variant={p.variant} size="sm">{p.label}</Badge>
                        <Badge variant={s.variant} size="sm">{s.label}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {ticket.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ticket.tenant.name} · {formatDateTime(ticket.createdAt)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1 group-hover:text-primary transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Activity Log */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm">Letzte Aktivitäten</h2>
              <Link
                href="/audit-log"
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Alle
              </Link>
            </div>
            {recentAuditLogs.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">Keine Aktivitäten</div>
            ) : (
              <div className="divide-y divide-border">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <p className="text-xs font-medium text-foreground truncate">{log.action}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {log.user?.name ?? "System"}
                      </span>
                      <span className="text-muted-foreground/50 text-xs">·</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick access to tenants */}
          {tenants.length > 0 && (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground text-sm">Meine Mandanten</h2>
                {session.user.isSuperAdmin && (
                  <Link href="/tenants" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    Alle
                  </Link>
                )}
              </div>
              <div className="divide-y divide-border">
                {tenants.slice(0, 6).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tenants/${t.id}/dashboard`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {t.name}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
              {session.user.isSuperAdmin && (
                <div className="px-5 py-3 border-t border-border">
                  <Link
                    href="/tenants/new"
                    className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Neuer Mandant
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
