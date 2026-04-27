import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createCredential } from "../../_actions";
import { Card, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

export default async function NewCredentialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageCredentials(ctx.role)) redirect(`/tenants/${id}/credentials`);

  const [tenant, employees, devices] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.employee.findMany({ where: { tenantId: id }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.device.findMany({ where: { tenantId: id, status: "ACTIVE" }, orderBy: [{ manufacturer: "asc" }, { model: "asc" }], select: { id: true, type: true, manufacturer: true, model: true, hostname: true } }),
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Zugangsdaten" title="Neue Zugangsdaten" backHref={`/tenants/${id}/credentials`} />
      <form action={createCredential.bind(null, id)}>
        <Card className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Allgemein</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Name" name="name" required />
              <TextInput label="Kategorie" name="category" placeholder="z. B. Microsoft 365, VPN" />
              <TextInput label="Benutzername" name="username" />
              <TextInput label="Passwort" name="password" type="password" />
              <TextInput label="URL" name="url" type="url" />
              <TextInput label="Ablaufdatum" name="expiresAt" type="date" />
              <TextInput label="Externe Referenz" name="externalRef" />
              <SelectInput label="Mitarbeiter" name="employeeId" options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
              <SelectInput label="Gerät" name="deviceId" options={[{ value: "", label: "Kein Gerät" }, ...devices.map((d) => ({ value: d.id, label: [d.manufacturer, d.model, d.hostname].filter(Boolean).join(" – ") || d.type }))]} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Fernzugang (RustDesk)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="RustDesk ID" name="rustdeskId" placeholder="z. B. 123456789" />
              <TextInput label="RustDesk Passwort" name="rustdeskPassword" type="password" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Fernzugang (TeamViewer)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="TeamViewer ID" name="teamviewerId" placeholder="z. B. 987 654 321" />
              <TextInput label="TeamViewer Passwort" name="teamviewerPassword" type="password" />
            </div>
          </div>

          <Textarea label="Verschlüsselte Notizen" name="notes" />
          <div className="flex justify-end"><SubmitButton>Zugangsdaten anlegen</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
