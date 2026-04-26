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

  const [tenant, employees] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.employee.findMany({ where: { tenantId: id }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Zugangsdaten" title="Neue Zugangsdaten" backHref={`/tenants/${id}/credentials`} />
      <form action={createCredential.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Name" name="name" required />
            <TextInput label="Kategorie" name="category" placeholder="z. B. Microsoft 365, VPN" />
            <TextInput label="Benutzername" name="username" />
            <TextInput label="Passwort" name="password" type="password" />
            <TextInput label="URL" name="url" type="url" />
            <TextInput label="Ablaufdatum" name="expiresAt" type="date" />
            <TextInput label="Externe Referenz" name="externalRef" />
            <SelectInput label="Mitarbeiter" name="employeeId" options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
          </div>
          <Textarea label="Verschlüsselte Notizen" name="notes" />
          <div className="flex justify-end"><SubmitButton>Zugangsdaten anlegen</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
