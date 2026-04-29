import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { deleteSoftware, updateSoftware } from "../../_actions";
import { Card, DeleteButton, PageHeader, SelectInput, SubmitButton, TextInput, Textarea, formatInputDate } from "../../_components/form-controls";

const licenseTypes = [
  ["PERPETUAL", "Dauerlizenz"], ["SUBSCRIPTION", "Abonnement"], ["VOLUME", "Volumenlizenz"], ["OEM", "OEM"],
  ["FREEWARE", "Freeware"], ["OPEN_SOURCE", "Open Source"], ["TRIAL", "Testversion"],
] as const;

export default async function SoftwareDetailPage({ params }: { params: Promise<{ id: string; softwareId: string }> }) {
  const { id, softwareId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewSoftware(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const [tenant, software] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.software.findFirst({
      where: { id: softwareId, tenantId: id },
      include: {
        employees: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
        devices: { include: { device: { select: { id: true, type: true, manufacturer: true, model: true } } } },
      },
    }),
  ]);
  if (!tenant || !software) notFound();
  const canEdit = can.manageSoftware(ctx.role);
  const assigned = software.employees.length + software.devices.length;

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Software" title={software.name} subtitle={`Erstellt am ${formatDate(software.createdAt)}`} backHref={`/tenants/${id}/software`} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form action={updateSoftware.bind(null, id, software.id)} className="xl:col-span-2">
          <Card className="space-y-5">
            <h2 className="font-semibold text-gray-900">Lizenzdaten</h2>
            <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput label="Name" name="name" defaultValue={software.name} required />
                <TextInput label="Hersteller" name="vendor" defaultValue={software.vendor} />
                <TextInput label="Version" name="version" defaultValue={software.version} />
                <SelectInput label="Lizenztyp" name="licenseType" defaultValue={software.licenseType} options={licenseTypes.map(([value, label]) => ({ value, label }))} />
                <TextInput label="Lizenzschlüssel" name="licenseKey" defaultValue={software.licenseKey} />
                <TextInput label="Anzahl Lizenzen" name="licenseCount" type="number" defaultValue={software.licenseCount} />
                <TextInput label="Gültig von" name="validFrom" type="date" defaultValue={formatInputDate(software.validFrom)} />
                <TextInput label="Gültig bis" name="validUntil" type="date" defaultValue={formatInputDate(software.validUntil)} />
                <TextInput label="Kostenstelle" name="costCenter" defaultValue={software.costCenter} />
                <TextInput label="Kaufpreis" name="purchasePrice" type="number" defaultValue={software.purchasePrice?.toString()} />
                <TextInput label="Externe Referenz" name="externalRef" defaultValue={software.externalRef} />
              </div>
              <Textarea label="Notizen" name="notes" defaultValue={software.notes} />
            </fieldset>
            {canEdit && <div className="flex justify-end"><SubmitButton>Änderungen speichern</SubmitButton></div>}
          </Card>
        </form>

        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Nutzung</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-400">Lizenzen</dt><dd>{software.licenseCount ?? "Unbegrenzt"}</dd></div>
              <div><dt className="text-gray-400">Zugewiesen</dt><dd>{assigned}</dd></div>
              <div><dt className="text-gray-400">Gültig bis</dt><dd>{formatDate(software.validUntil)}</dd></div>
            </dl>
          </Card>
          {canEdit && (
            <form action={deleteSoftware.bind(null, id, software.id)}>
              <Card className="border-red-100 bg-red-50/50">
                <h2 className="font-semibold text-red-900 mb-2">Software löschen</h2>
                <p className="text-sm text-red-700 mb-3">Entfernt diese Lizenz dauerhaft.</p>
                <DeleteButton>Software löschen</DeleteButton>
              </Card>
            </form>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Mitarbeiter</h2>
          <div className="space-y-2">
            {software.employees.length === 0 && <p className="text-sm text-gray-400">Keine Mitarbeiter zugeordnet</p>}
            {software.employees.map((entry) => (
              <Link key={entry.employeeId} href={`/tenants/${id}/employees/${entry.employeeId}`} className="block text-sm rounded-lg border border-gray-100 p-3 hover:border-blue-300">
                {entry.employee.firstName} {entry.employee.lastName}
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Geräte</h2>
          <div className="space-y-2">
            {software.devices.length === 0 && <p className="text-sm text-gray-400">Keine Geräte zugeordnet</p>}
            {software.devices.map((entry) => (
              <Link key={entry.deviceId} href={`/tenants/${id}/devices/${entry.deviceId}`} className="block text-sm rounded-lg border border-gray-100 p-3 hover:border-blue-300">
                {[entry.device.manufacturer, entry.device.model].filter(Boolean).join(" ") || entry.device.type}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
