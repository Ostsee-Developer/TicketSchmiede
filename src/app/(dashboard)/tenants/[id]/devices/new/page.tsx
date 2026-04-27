import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createDevice } from "../../_actions";
import { Card, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

const deviceTypes = [
  ["LAPTOP", "Laptop"], ["PC", "PC"], ["SERVER", "Server"], ["PRINTER", "Drucker"],
  ["FIREWALL", "Firewall"], ["SWITCH", "Switch"], ["ROUTER", "Router"], ["SMARTPHONE", "Smartphone"],
  ["TABLET", "Tablet"], ["MONITOR", "Monitor"], ["DOCKING_STATION", "Docking Station"], ["NAS", "NAS"],
  ["ACCESS_POINT", "Access Point"], ["UPS", "USV"], ["OTHER", "Sonstiges"],
] as const;

const osOptions = [
  { value: "", label: "Kein Betriebssystem" },
  { value: "WINDOWS_10", label: "Windows 10" },
  { value: "WINDOWS_11", label: "Windows 11" },
  { value: "WINDOWS_SERVER_2019", label: "Windows Server 2019" },
  { value: "WINDOWS_SERVER_2022", label: "Windows Server 2022" },
  { value: "WINDOWS_SERVER_2025", label: "Windows Server 2025" },
  { value: "MACOS", label: "macOS" },
  { value: "LINUX", label: "Linux" },
  { value: "UBUNTU", label: "Ubuntu" },
  { value: "DEBIAN", label: "Debian" },
  { value: "CENTOS", label: "CentOS" },
  { value: "RHEL", label: "Red Hat Enterprise Linux" },
  { value: "OTHER", label: "Sonstiges" },
];

export default async function NewDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.manageDevices(ctx.role)) redirect(`/tenants/${id}/devices`);

  const [tenant, locations, employees, workstations] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.location.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.findMany({ where: { tenantId: id }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.workstation.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Geräte" title="Neues Gerät" backHref={`/tenants/${id}/devices`} />
      <form action={createDevice.bind(null, id)}>
        <Card className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput label="Typ" name="type" defaultValue="LAPTOP" options={deviceTypes.map(([value, label]) => ({ value, label }))} />
            <SelectInput label="Status" name="status" defaultValue="ACTIVE" options={[
              { value: "ACTIVE", label: "Aktiv" }, { value: "IN_STORAGE", label: "Lager" }, { value: "IN_REPAIR", label: "Reparatur" }, { value: "DECOMMISSIONED", label: "Ausgemustert" }, { value: "LOST", label: "Verloren" },
            ]} />
            <TextInput label="Hersteller" name="manufacturer" />
            <TextInput label="Modell" name="model" />
            <TextInput label="Seriennummer" name="serialNumber" />
            <TextInput label="Inventarnummer" name="inventoryNumber" />
            <TextInput label="Hostname" name="hostname" />
            <TextInput label="IP-Adresse" name="ipAddress" />
            <TextInput label="MAC-Adresse" name="macAddress" />
            <SelectInput label="Betriebssystem" name="os" options={osOptions} />
            <TextInput label="OS-Version" name="osVersion" />
            <TextInput label="Kaufdatum" name="purchaseDate" type="date" />
            <TextInput label="Garantie bis" name="warrantyUntil" type="date" />
            <TextInput label="Externe Referenz" name="externalRef" />
            <SelectInput label="Standort" name="locationId" options={[{ value: "", label: "Kein Standort" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
            <SelectInput label="Mitarbeiter" name="employeeId" options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
            <SelectInput label="Arbeitsplatz" name="workstationId" options={[{ value: "", label: "Kein Arbeitsplatz" }, ...workstations.map((w) => ({ value: w.id, label: w.name }))]} />
          </div>
          <Textarea label="Notizen" name="notes" />
          <div className="flex justify-end"><SubmitButton>Gerät anlegen</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
