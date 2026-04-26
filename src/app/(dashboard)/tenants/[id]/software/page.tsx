import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Software` };
}

const licenseTypeLabel: Record<string, string> = {
  PERPETUAL: "Dauerlizenz",
  SUBSCRIPTION: "Abonnement",
  VOLUME: "Volumenlizenz",
  OEM: "OEM",
  FREEWARE: "Freeware",
  OPEN_SOURCE: "Open Source",
  TRIAL: "Testversion",
};

export default async function TenantSoftwarePage({
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

  const software = await prisma.software.findMany({
    where: { tenantId: id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { employees: true, devices: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/tenants/${id}/dashboard`} className="hover:text-blue-600">{tenant.name}</Link>
            <span>/</span>
            <span>Software</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Software & Lizenzen</h1>
          <p className="text-gray-400 text-sm">{software.length} Einträge</p>
        </div>
        <Link
          href={`/tenants/${id}/software/new`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Software
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Hersteller</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Lizenztyp</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Lizenzen</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Zugewiesen</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Gültig bis</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {software.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Keine Software gefunden</td>
              </tr>
            )}
            {software.map((s) => {
              const expiringSoon = s.validUntil && s.validUntil <= ninetyDays && s.validUntil >= now;
              const expired = s.validUntil && s.validUntil < now;
              const assigned = s._count.employees + s._count.devices;
              const overLicensed = s.licenseCount != null && assigned > s.licenseCount;

              return (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    {s.version && <span className="ml-2 text-xs text-gray-400">v{s.version}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.vendor ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {licenseTypeLabel[s.licenseType] ?? s.licenseType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {s.licenseCount ?? "∞"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={overLicensed ? "text-red-600 font-bold" : "text-gray-700"}>
                      {assigned}
                      {overLicensed && " ⚠️"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.validUntil ? (
                      <span className={expired ? "text-red-600 font-medium" : expiringSoon ? "text-yellow-600 font-medium" : "text-gray-600"}>
                        {formatDate(s.validUntil)}
                        {expiringSoon && !expired && " ⚠️"}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenants/${id}/software/${s.id}`}
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
  );
}
