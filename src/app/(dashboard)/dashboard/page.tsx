import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTenants } from "@/lib/tenant";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const tenants = await getUserTenants(session.user.id, session.user.isSuperAdmin);

  const stats = await prisma.$transaction([
    prisma.ticket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.ticket.count({ where: { priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.device.count({ where: { warrantyUntil: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }, status: "ACTIVE" } }),
  ]);

  const [openTickets, criticalTickets, activeTenants, expiringWarranties] = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Willkommen zurück, {session.user.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Offene Tickets"
          value={openTickets}
          color="blue"
          href="/tickets"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
        <StatCard
          title="Kritische Tickets"
          value={criticalTickets}
          color="red"
          href="/tickets?priority=CRITICAL"
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
        <StatCard
          title="Aktive Mandanten"
          value={activeTenants}
          color="green"
          href="/tenants"
          icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
        <StatCard
          title="Garantien ablaufend"
          value={expiringWarranties}
          color="yellow"
          href="/devices?filter=warranty"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      {/* Tenant Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Mandanten</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/tenants/${t.id}/dashboard`}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-lg">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-400">{t.slug}</p>
                </div>
              </div>
              <div className="flex items-center text-xs text-gray-400 gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Zur IT-Dokumentation
              </div>
            </Link>
          ))}
          {session.user.isSuperAdmin && (
            <Link
              href="/tenants/new"
              className="bg-white rounded-xl border border-dashed border-gray-300 p-4 hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-blue-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">Neuer Mandant</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  href,
  icon,
}: {
  title: string;
  value: number;
  color: "blue" | "red" | "green" | "yellow";
  href: string;
  icon: string;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };

  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </Link>
  );
}
