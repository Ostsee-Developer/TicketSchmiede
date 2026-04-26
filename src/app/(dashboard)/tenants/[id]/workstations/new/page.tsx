import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createWorkstation } from "../../_actions";
import { Card, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

export default async function NewWorkstationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageDevices(ctx.role)) redirect(`/tenants/${id}/workstations`);

  const [tenant, locations, employees] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.location.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.findMany({ where: { tenantId: id, workstation: null }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Arbeitsplätze" title="Neuer Arbeitsplatz" backHref={`/tenants/${id}/workstations`} />
      <form action={createWorkstation.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Name" name="name" required />
            <TextInput label="Raum" name="room" />
            <TextInput label="Netzwerkdose" name="networkOutlet" />
            <TextInput label="IP-Adresse" name="ipAddress" />
            <TextInput label="Externe Referenz" name="externalRef" />
            <SelectInput label="Standort" name="locationId" options={[{ value: "", label: "Kein Standort" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
            <SelectInput label="Mitarbeiter" name="employeeId" options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
          </div>
          <Textarea label="Notizen" name="notes" />
          <div className="flex justify-end"><SubmitButton>Arbeitsplatz anlegen</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
