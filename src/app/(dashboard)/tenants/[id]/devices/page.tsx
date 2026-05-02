import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Geräte` };
}

const deviceTypeLabel: Record<string, string> = {
  LAPTOP: "Laptop", PC: "PC", SERVER: "Server", PRINTER: "Drucker",
  FIREWALL: "Firewall", SWITCH: "Switch", ROUTER: "Router",
  SMARTPHONE: "Smartphone", TABLET: "Tablet", MONITOR: "Monitor",
  DOCKING_STATION: "Docking", NAS: "NAS", ACCESS_POINT: "Access Point",
  UPS: "USV", OTHER: "Sonstiges",
};

const statusBadge = (s: string) => ({
  ACTIVE: "bg-green-100 text-green-700",
  IN_STORAGE: "bg-gray-100 text-gray-500",
  IN_REPAIR: "bg-yellow-100 text-yellow-700",
  DECOMMISSIONED: "bg-red-100 text-red-600",
  LOST: "bg-red-100 text-red-700",
}[s] ?? "bg-gray-100 text-gray-600");

const statusLabel = (s: string) => ({
  ACTIVE: "Aktiv", IN_STORAGE: "Lager", IN_REPAIR: "Reparatur",
  DECOMMISSIONED: "Ausgemustert", LOST: "Verloren",
}[s] ?? s);

export default async function TenantDevicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; status?: string; search?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const where = {
    tenantId: id,
    ...(sp.type ? { type: sp.type as "LAPTOP" } : {}),
    ...(sp.status ? { status: sp.status as "ACTIVE" } : {}),
    ...(sp.search ? {
      OR: [
        { manufacturer: { contains: sp.search, mode: "insensitive" as const } },
        { model: { contains: sp.search, mode: "insensitive" as const } },
        { serialNumber: { contains: sp.search, mode: "insensitive" as const } },
        { inventoryNumber: { contains: sp.search, mode: "insensitive" as const } },
        { hostname: { contains: sp.search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const devices = await prisma.device.findMany({
    where,
    orderBy: [{ type: "asc" }, { manufacturer: "asc" }],
    include: {
      location: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
      workstation: { select: { name: true } },
    },
  });

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/tenants/${id}/dashboard`} className="hover:text-blue-600">{tenant.name}</Link>
            <span>/</span>
            <span>Geräte</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Geräte & Assets</h1>
          <p className="text-gray-400 text-sm">{devices.length} Geräte</p>
        </div>
        <Link
          href={`/tenants/${id}/devices/new`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Gerät
        </Link>
      </div>

      <div className="grid gap-3 md:hidden">
        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-400">
            Keine Geräte gefunden
          </div>
        ) : (
          devices.map((d) => {
            const warrantyExpiring = d.warrantyUntil && d.warrantyUntil <= thirtyDays && d.warrantyUntil >= now;
            const warrantyExpired = d.warrantyUntil && d.warrantyUntil < now;
            const assignedTo = d.employee
              ? `${d.employee.firstName} ${d.employee.lastName}`
              : d.workstation?.name ?? null;

            return (
              <Link
                key={d.id}
                href={`/tenants/${id}/devices/${d.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-sm active:scale-[.99]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {deviceTypeLabel[d.type] ?? d.type}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(d.status)}`}>
                        {statusLabel(d.status)}
                      </span>
                    </div>
                    <p className="truncate font-semibold text-gray-950">
                      {[d.manufacturer, d.model].filter(Boolean).join(" ") || "Unbekanntes Gerät"}
                    </p>
                    {d.hostname ? <p className="truncate text-xs text-gray-400">{d.hostname}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-blue-600">Details</span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs">
                  <div>
                    <p className="text-gray-400">Seriennummer</p>
                    <p className="mt-0.5 truncate font-mono text-gray-700">{d.serialNumber ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Inventar</p>
                    <p className="mt-0.5 truncate font-mono text-gray-700">{d.inventoryNumber ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Zugewiesen</p>
                    <p className="mt-0.5 truncate text-gray-700">{assignedTo ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Standort</p>
                    <p className="mt-0.5 truncate text-gray-700">{d.location?.name ?? "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400">Garantie</p>
                    {d.warrantyUntil ? (
                      <p className={warrantyExpired ? "mt-0.5 font-medium text-red-600" : warrantyExpiring ? "mt-0.5 font-medium text-yellow-600" : "mt-0.5 text-gray-700"}>
                        {formatDate(d.warrantyUntil)}
                        {warrantyExpiring && " - läuft bald ab"}
                        {warrantyExpired && " - abgelaufen"}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-gray-400">—</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Typ</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Hersteller / Modell</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Seriennummer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Zugewiesen</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Standort</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Garantie bis</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {devices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Keine Geräte gefunden</td>
              </tr>
            )}
            {devices.map((d) => {
              const warrantyExpiring = d.warrantyUntil && d.warrantyUntil <= thirtyDays && d.warrantyUntil >= now;
              const warrantyExpired = d.warrantyUntil && d.warrantyUntil < now;
              return (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                      {deviceTypeLabel[d.type] ?? d.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      {[d.manufacturer, d.model].filter(Boolean).join(" ") || "—"}
                    </span>
                    {d.hostname && <p className="text-xs text-gray-400">{d.hostname}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.serialNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {d.employee
                      ? `${d.employee.firstName} ${d.employee.lastName}`
                      : d.workstation?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{d.location?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {d.warrantyUntil ? (
                      <span className={warrantyExpired ? "text-red-600 font-medium" : warrantyExpiring ? "text-yellow-600 font-medium" : "text-gray-600"}>
                        {formatDate(d.warrantyUntil)}
                        {warrantyExpiring && " ⚠️"}
                        {warrantyExpired && " ✗"}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(d.status)}`}>
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenants/${id}/devices/${d.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
