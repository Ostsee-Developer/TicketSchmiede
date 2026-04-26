import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: tenant ? `${tenant.name} – Dashboard` : "Dashboard" };
}

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const now = new Date();
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    openTickets,
    criticalTickets,
    employeeCount,
    deviceCount,
    expiringWarranties,
    expiringLicenses,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count({
      where: { tenantId: id, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.ticket.count({
      where: { tenantId: id, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.employee.count({ where: { tenantId: id, status: "ACTIVE" } }),
    prisma.device.count({ where: { tenantId: id, status: "ACTIVE" } }),
    prisma.device.findMany({
      where: { tenantId: id, warrantyUntil: { gte: now, lte: ninetyDays }, status: "ACTIVE" },
      orderBy: { warrantyUntil: "asc" },
      take: 5,
      select: { id: true, manufacturer: true, model: true, type: true, warrantyUntil: true },
    }),
    prisma.software.findMany({
      where: { tenantId: id, validUntil: { gte: now, lte: ninetyDays } },
      orderBy: { validUntil: "asc" },
      take: 5,
      select: { id: true, name: true, validUntil: true, licenseCount: true },
    }),
    prisma.ticket.findMany({
      where: { tenantId: id, status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    }),
  ]);

  const priorityColor = (p: string) => ({
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-gray-100 text-gray-600",
  }[p] ?? "bg-gray-100 text-gray-600");

  const statusColor = (s: string) => ({
    NEW: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
  }[s] ?? "bg-gray-100 text-gray-600");

  const statusLabel = (s: string) => ({
    NEW: "Neu",
    IN_PROGRESS: "In Bearbeitung",
    WAITING_FOR_CUSTOMER: "Wartet auf Kunde",
    RESOLVED: "Gelöst",
    CLOSED: "Geschlossen",
  }[s] ?? s);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="text-gray-500 text-sm">IT-Dokumentation & Übersicht</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Offene Tickets", value: openTickets, color: "blue", href: `/tenants/${id}/tickets` },
          { label: "Kritische Tickets", value: criticalTickets, color: "red", href: `/tenants/${id}/tickets?priority=CRITICAL` },
          { label: "Aktive Mitarbeiter", value: employeeCount, color: "green", href: `/tenants/${id}/employees` },
          { label: "Aktive Geräte", value: deviceCount, color: "gray", href: `/tenants/${id}/devices` },
        ].map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Offene Tickets</h2>
            <Link href={`/tenants/${id}/tickets`} className="text-xs text-blue-600 hover:text-blue-800">
              Alle anzeigen →
            </Link>
          </div>
          {recentTickets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Keine offenen Tickets</p>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/tenants/${id}/tickets/${t.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-gray-400">#{t.number}</span>
                    <span className="text-sm text-gray-800 truncate">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColor(t.priority)}`}>
                      {t.priority}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Expiry Warnings */}
        <div className="space-y-4">
          {expiringWarranties.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
              <h2 className="font-semibold text-yellow-800 mb-3">Garantien ablaufend (90 Tage)</h2>
              <div className="space-y-2">
                {expiringWarranties.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-yellow-800">{d.manufacturer} {d.model} ({d.type})</span>
                    <span className="text-yellow-600 font-medium">{formatDate(d.warrantyUntil)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiringLicenses.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <h2 className="font-semibold text-orange-800 mb-3">Lizenzen ablaufend (90 Tage)</h2>
              <div className="space-y-2">
                {expiringLicenses.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-orange-800">{s.name}</span>
                    <span className="text-orange-600 font-medium">{formatDate(s.validUntil)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiringWarranties.length === 0 && expiringLicenses.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-green-700 font-medium">Keine ablaufenden Garantien oder Lizenzen in den nächsten 90 Tagen.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Mitarbeiter", href: `/tenants/${id}/employees`, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
          { label: "Arbeitsplätze", href: `/tenants/${id}/workstations`, icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
          { label: "Geräte", href: `/tenants/${id}/devices`, icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
          { label: "Software", href: `/tenants/${id}/software`, icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
          { label: "Zugangsdaten", href: `/tenants/${id}/credentials`, icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
          { label: "Tickets", href: `/tenants/${id}/tickets`, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <svg className="w-6 h-6 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
