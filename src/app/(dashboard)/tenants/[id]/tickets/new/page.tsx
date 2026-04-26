import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createTicket } from "../../_actions";
import { Card, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

export default async function NewTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");

  const [tenant, employees, workstations, devices] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.employee.findMany({ where: { tenantId: id }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.workstation.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.device.findMany({ where: { tenantId: id }, orderBy: [{ type: "asc" }, { manufacturer: "asc" }], select: { id: true, type: true, manufacturer: true, model: true, hostname: true } }),
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Tickets" title="Neues Ticket" backHref={`/tenants/${id}/tickets`} />
      <form action={createTicket.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Titel" name="title" required />
            <SelectInput label="Priorität" name="priority" defaultValue="MEDIUM" options={[
              { value: "LOW", label: "Niedrig" }, { value: "MEDIUM", label: "Mittel" }, { value: "HIGH", label: "Hoch" }, { value: "CRITICAL", label: "Kritisch" },
            ]} />
            <SelectInput label="Kategorie" name="category" defaultValue="OTHER" options={[
              { value: "HARDWARE", label: "Hardware" }, { value: "SOFTWARE", label: "Software" }, { value: "EMAIL", label: "E-Mail" }, { value: "NETWORK", label: "Netzwerk" }, { value: "USER_ACCOUNT", label: "Benutzerkonto" }, { value: "PRINTER", label: "Drucker" }, { value: "PHONE", label: "Telefon" }, { value: "VPN", label: "VPN" }, { value: "OTHER", label: "Sonstiges" },
            ]} />
            <SelectInput label="Mitarbeiter" name="employeeId" options={[{ value: "", label: "Nicht zugeordnet" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
            <SelectInput label="Arbeitsplatz" name="workstationId" options={[{ value: "", label: "Nicht zugeordnet" }, ...workstations.map((w) => ({ value: w.id, label: w.name }))]} />
            <SelectInput label="Gerät" name="deviceId" options={[{ value: "", label: "Nicht zugeordnet" }, ...devices.map((d) => ({ value: d.id, label: [d.hostname, d.manufacturer, d.model, d.type].filter(Boolean).join(" · ") }))]} />
          </div>
          <Textarea label="Beschreibung" name="description" rows={8} />
          <div className="flex justify-end"><SubmitButton>Ticket anlegen</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
