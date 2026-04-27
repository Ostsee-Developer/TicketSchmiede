import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EmployeeWizard } from "./EmployeeWizard";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Neuer Mitarbeiter Wizard` };
}

export default async function EmployeeWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageEmployees(ctx.role)) redirect(`/tenants/${id}/employees`);

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!tenant) notFound();

  const [locations, workstations, availableDevices, availableSoftware] = await Promise.all([
    prisma.location.findMany({
      where: { tenantId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workstation.findMany({
      where: { tenantId: id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: { select: { name: true } },
      },
    }),
    prisma.device.findMany({
      where: { tenantId: id, employeeId: null, status: "ACTIVE" },
      orderBy: [{ type: "asc" }, { manufacturer: "asc" }],
      select: { id: true, manufacturer: true, model: true, type: true, serialNumber: true },
    }),
    prisma.software.findMany({
      where: { tenantId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, vendor: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link
          href={`/tenants/${id}/employees`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Zurück zu Mitarbeiter
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Neuer Mitarbeiter</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tenant.name} · Geführter Einrichtungs-Assistent
        </p>
      </div>

      <EmployeeWizard
        tenantId={id}
        tenantName={tenant.name}
        locations={locations}
        workstations={workstations}
        availableDevices={availableDevices}
        availableSoftware={availableSoftware}
      />
    </div>
  );
}
