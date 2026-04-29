import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createSoftware } from "../../_actions";
import { Card, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

const licenseTypes = [
  ["PERPETUAL", "Dauerlizenz"], ["SUBSCRIPTION", "Abonnement"], ["VOLUME", "Volumenlizenz"], ["OEM", "OEM"],
  ["FREEWARE", "Freeware"], ["OPEN_SOURCE", "Open Source"], ["TRIAL", "Testversion"],
] as const;

export default async function NewSoftwarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageSoftware(ctx.role)) redirect(`/tenants/${id}/software`);
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Software" title="Neue Software" backHref={`/tenants/${id}/software`} />
      <form action={createSoftware.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Name" name="name" required />
            <TextInput label="Hersteller" name="vendor" />
            <TextInput label="Version" name="version" />
            <SelectInput label="Lizenztyp" name="licenseType" defaultValue="PERPETUAL" options={licenseTypes.map(([value, label]) => ({ value, label }))} />
            <TextInput label="Lizenzschlüssel" name="licenseKey" />
            <TextInput label="Anzahl Lizenzen" name="licenseCount" type="number" />
            <TextInput label="Gültig von" name="validFrom" type="date" />
            <TextInput label="Gültig bis" name="validUntil" type="date" />
            <TextInput label="Kostenstelle" name="costCenter" />
            <TextInput label="Kaufpreis" name="purchasePrice" type="number" />
            <TextInput label="Externe Referenz" name="externalRef" />
          </div>
          <Textarea label="Notizen" name="notes" />
          <div className="flex justify-end"><SubmitButton>Software anlegen</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
