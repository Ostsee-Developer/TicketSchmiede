import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Arbeitsplätze` };
}

export default async function TenantWorkstationsPage({
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

  const workstations = await prisma.workstation.findMany({
    where: { tenantId: id },
    orderBy: { name: "asc" },
    include: {
      location: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true, status: true } },
      devices: { select: { id: true, type: true, manufacturer: true, model: true } },
    },
  });

  const deviceTypeLabel: Record<string, string> = {
    LAPTOP: "Laptop", PC: "PC", MONITOR: "Monitor",
    DOCKING_STATION: "Docking", PRINTER: "Drucker", OTHER: "Sonstiges",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/tenants/${id}/dashboard`} className="hover:text-blue-600">{tenant.name}</Link>
            <span>/</span>
            <span>Arbeitsplätze</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Arbeitsplätze</h1>
          <p className="text-gray-400 text-sm">{workstations.length} Arbeitsplätze</p>
        </div>
        <Link
          href={`/tenants/${id}/workstations/new`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Arbeitsplatz
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workstations.length === 0 && (
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Keine Arbeitsplätze vorhanden
          </div>
        )}
        {workstations.map((w) => (
          <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{w.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  {w.room && <span>Raum: {w.room}</span>}
                  {w.location && <span>· {w.location.name}</span>}
                </div>
              </div>
              <Link
                href={`/tenants/${id}/workstations/${w.id}`}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Details →
              </Link>
            </div>

            {/* Mitarbeiter */}
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-500">Mitarbeiter: </span>
              {w.employee ? (
                <span className={`text-xs ${w.employee.status === "LEFT" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                  {w.employee.firstName} {w.employee.lastName}
                </span>
              ) : (
                <span className="text-xs text-gray-300">Nicht zugewiesen</span>
              )}
            </div>

            {/* Geräte */}
            {w.devices.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {w.devices.map((d) => (
                  <span key={d.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {deviceTypeLabel[d.type] ?? d.type}
                    {d.manufacturer ? ` · ${d.manufacturer}` : ""}
                  </span>
                ))}
              </div>
            )}

            {/* IP / Netzwerk */}
            {(w.ipAddress || w.networkOutlet) && (
              <div className="mt-2 flex gap-3 text-xs text-gray-400">
                {w.ipAddress && <span>IP: <span className="font-mono">{w.ipAddress}</span></span>}
                {w.networkOutlet && <span>Dose: {w.networkOutlet}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
