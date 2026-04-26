import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createEmployee } from "../../_actions";
import { Card, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

export default async function NewEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageEmployees(ctx.role)) redirect(`/tenants/${id}/employees`);

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  if (!tenant) notFound();

  const locations = await prisma.location.findMany({
    where: { tenantId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Mitarbeiter" title="Neuer Mitarbeiter" backHref={`/tenants/${id}/employees`} />

      <form action={createEmployee.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Vorname" name="firstName" required />
            <TextInput label="Nachname" name="lastName" required />
            <TextInput label="E-Mail" name="email" type="email" />
            <TextInput label="Telefon" name="phone" />
            <TextInput label="Mobil" name="mobile" />
            <TextInput label="Position" name="position" />
            <TextInput label="Abteilung" name="department" />
            <SelectInput
              label="Standort"
              name="locationId"
              options={[{ value: "", label: "Kein Standort" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            />
            <SelectInput
              label="Status"
              name="status"
              defaultValue="ACTIVE"
              options={[
                { value: "ACTIVE", label: "Aktiv" },
                { value: "DISABLED", label: "Deaktiviert" },
                { value: "LEFT", label: "Ausgeschieden" },
              ]}
            />
            <TextInput label="Externe Referenz" name="externalRef" />
            <TextInput label="Startdatum" name="startDate" type="date" />
            <TextInput label="Enddatum" name="endDate" type="date" />
          </div>
          <Textarea label="Notizen" name="notes" />
          <div className="flex justify-end">
            <SubmitButton>Mitarbeiter anlegen</SubmitButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
