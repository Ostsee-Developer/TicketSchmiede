import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { PageHeader } from "../_components/form-controls";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: tenant ? `${tenant.name} – Standorte` : "Standorte" };
}

export default async function LocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewDevices(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  if (!tenant) notFound();

  const locations = await prisma.location.findMany({
    where: { tenantId: id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { employees: true, devices: true, workstations: true } },
    },
  });

  const canManage = can.manageDevices(ctx.role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          tenantId={id}
          tenantName={tenant.name}
          section="Standorte"
          title="Standorte"
          subtitle={`${locations.length} Standort${locations.length !== 1 ? "e" : ""}`}
        />
        {canManage && (
          <Link
            href={`/tenants/${id}/locations/new`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neuer Standort
          </Link>
        )}
      </div>

      {locations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 mb-3">Noch keine Standorte angelegt</p>
          {canManage && (
            <Link
              href={`/tenants/${id}/locations/new`}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Ersten Standort anlegen →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <Link
              key={loc.id}
              href={`/tenants/${id}/locations/${loc.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{loc.name}</p>
                  {(loc.street || loc.city) && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {[loc.street, loc.zipCode, loc.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>{loc._count.employees} Mitarbeiter</span>
                    <span>{loc._count.devices} Geräte</span>
                    <span>{loc._count.workstations} Arbeitsplätze</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
