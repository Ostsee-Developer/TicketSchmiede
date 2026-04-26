import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { deleteDevice, updateDevice } from "../../_actions";
import { Card, DeleteButton, PageHeader, SelectInput, SubmitButton, TextInput, Textarea, formatInputDate } from "../../_components/form-controls";

const deviceTypes = [
  ["LAPTOP", "Laptop"], ["PC", "PC"], ["SERVER", "Server"], ["PRINTER", "Drucker"],
  ["FIREWALL", "Firewall"], ["SWITCH", "Switch"], ["ROUTER", "Router"], ["SMARTPHONE", "Smartphone"],
  ["TABLET", "Tablet"], ["MONITOR", "Monitor"], ["DOCKING_STATION", "Docking Station"], ["NAS", "NAS"],
  ["ACCESS_POINT", "Access Point"], ["UPS", "USV"], ["OTHER", "Sonstiges"],
] as const;

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string; deviceId: string }> }) {
  const { id, deviceId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewDevices(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const [tenant, device, locations, employees, workstations] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.device.findFirst({
      where: { id: deviceId, tenantId: id },
      include: {
        location: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        software: { include: { software: { select: { id: true, name: true, version: true } } } },
        tickets: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, title: true, status: true } },
      },
    }),
    prisma.location.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.findMany({ where: { tenantId: id }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.workstation.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!tenant || !device) notFound();
  const canEdit = can.manageDevices(ctx.role);
  const title = [device.manufacturer, device.model].filter(Boolean).join(" ") || device.type;

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Geräte" title={title} subtitle={`Erstellt am ${formatDate(device.createdAt)}`} backHref={`/tenants/${id}/devices`} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form action={updateDevice.bind(null, id, device.id)} className="xl:col-span-2">
          <Card className="space-y-5">
            <h2 className="font-semibold text-gray-900">Gerätedaten</h2>
            <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectInput label="Typ" name="type" defaultValue={device.type} options={deviceTypes.map(([value, label]) => ({ value, label }))} />
                <SelectInput label="Status" name="status" defaultValue={device.status} options={[
                  { value: "ACTIVE", label: "Aktiv" }, { value: "IN_STORAGE", label: "Lager" }, { value: "IN_REPAIR", label: "Reparatur" }, { value: "DECOMMISSIONED", label: "Ausgemustert" }, { value: "LOST", label: "Verloren" },
                ]} />
                <TextInput label="Hersteller" name="manufacturer" defaultValue={device.manufacturer} />
                <TextInput label="Modell" name="model" defaultValue={device.model} />
                <TextInput label="Seriennummer" name="serialNumber" defaultValue={device.serialNumber} />
                <TextInput label="Inventarnummer" name="inventoryNumber" defaultValue={device.inventoryNumber} />
                <TextInput label="Hostname" name="hostname" defaultValue={device.hostname} />
                <TextInput label="IP-Adresse" name="ipAddress" defaultValue={device.ipAddress} />
                <TextInput label="MAC-Adresse" name="macAddress" defaultValue={device.macAddress} />
                <TextInput label="Betriebssystem" name="os" defaultValue={device.os} />
                <TextInput label="OS-Version" name="osVersion" defaultValue={device.osVersion} />
                <TextInput label="Kaufdatum" name="purchaseDate" type="date" defaultValue={formatInputDate(device.purchaseDate)} />
                <TextInput label="Garantie bis" name="warrantyUntil" type="date" defaultValue={formatInputDate(device.warrantyUntil)} />
                <TextInput label="Externe Referenz" name="externalRef" defaultValue={device.externalRef} />
                <SelectInput label="Standort" name="locationId" defaultValue={device.locationId} options={[{ value: "", label: "Kein Standort" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
                <SelectInput label="Mitarbeiter" name="employeeId" defaultValue={device.employeeId} options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
                <SelectInput label="Arbeitsplatz" name="workstationId" defaultValue={device.workstationId} options={[{ value: "", label: "Kein Arbeitsplatz" }, ...workstations.map((w) => ({ value: w.id, label: w.name }))]} />
              </div>
              <Textarea label="Notizen" name="notes" defaultValue={device.notes} />
            </fieldset>
            {canEdit && <div className="flex justify-end"><SubmitButton>Änderungen speichern</SubmitButton></div>}
          </Card>
        </form>

        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Zuweisung</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-400">Standort</dt><dd>{device.location?.name ?? "—"}</dd></div>
              <div><dt className="text-gray-400">Mitarbeiter</dt><dd>{device.employee ? `${device.employee.firstName} ${device.employee.lastName}` : "—"}</dd></div>
              <div><dt className="text-gray-400">Arbeitsplatz</dt><dd>{device.workstation?.name ?? "—"}</dd></div>
              <div><dt className="text-gray-400">Software</dt><dd>{device.software.length}</dd></div>
            </dl>
          </Card>
          {canEdit && (
            <form action={deleteDevice.bind(null, id, device.id)}>
              <Card className="border-red-100 bg-red-50/50">
                <h2 className="font-semibold text-red-900 mb-2">Gerät löschen</h2>
                <p className="text-sm text-red-700 mb-3">Entfernt das Gerät dauerhaft.</p>
                <DeleteButton>Gerät löschen</DeleteButton>
              </Card>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Software</h2>
          <div className="space-y-2">
            {device.software.length === 0 && <p className="text-sm text-gray-400">Keine Software zugeordnet</p>}
            {device.software.map((s) => (
              <Link key={s.softwareId} href={`/tenants/${id}/software/${s.softwareId}`} className="block text-sm rounded-lg border border-gray-100 p-3 hover:border-blue-300">
                <span className="font-medium text-gray-900">{s.software.name}</span> {s.software.version && <span className="text-xs text-gray-400">v{s.software.version}</span>}
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Tickets</h2>
          <div className="space-y-2">
            {device.tickets.length === 0 && <p className="text-sm text-gray-400">Keine Tickets</p>}
            {device.tickets.map((t) => (
              <Link key={t.id} href={`/tenants/${id}/tickets/${t.id}`} className="block text-sm rounded-lg border border-gray-100 p-3 hover:border-blue-300">
                <span className="font-mono text-gray-400">#{t.number}</span> <span className="font-medium text-gray-900">{t.title}</span>
                <span className="ml-2 text-xs text-gray-400">{t.status}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
