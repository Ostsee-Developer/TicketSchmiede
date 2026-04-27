import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createLocation } from "../../_actions";
import { Card, PageHeader, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

export default async function NewLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageDevices(ctx.role)) redirect(`/tenants/${id}/locations`);

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        tenantId={id}
        tenantName={tenant.name}
        section="Standorte"
        title="Neuer Standort"
        backHref={`/tenants/${id}/locations`}
      />
      <form action={createLocation.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Name" name="name" required />
            <TextInput label="Straße" name="street" />
            <TextInput label="PLZ" name="zipCode" />
            <TextInput label="Stadt" name="city" />
            <TextInput label="Land" name="country" defaultValue="DE" />
          </div>
          <Textarea label="Notizen" name="notes" />
          <div className="flex justify-end">
            <SubmitButton>Standort anlegen</SubmitButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
