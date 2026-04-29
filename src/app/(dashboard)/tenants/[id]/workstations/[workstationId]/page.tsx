import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { deleteWorkstation, updateWorkstation } from "../../_actions";
import { Card, DeleteButton, PageHeader, SelectInput, SubmitButton, TextInput, Textarea } from "../../_components/form-controls";

export default async function WorkstationDetailPage({ params }: { params: Promise<{ id: string; workstationId: string }> }) {
  const { id, workstationId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewDevices(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const [tenant, workstation, locations, employees] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.workstation.findFirst({
      where: { id: workstationId, tenantId: id },
      include: {
        location: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        devices: { select: { id: true, type: true, manufacturer: true, model: true, status: true } },
        tickets: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, title: true, status: true } },
      },
    }),
    prisma.location.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.findMany({
      where: { tenantId: id, OR: [{ workstation: null }, { workstation: { id: workstationId } }] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  if (!tenant || !workstation) notFound();
  const canEdit = can.manageDevices(ctx.role);

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Arbeitsplätze" title={workstation.name} subtitle={`Erstellt am ${formatDate(workstation.createdAt)}`} backHref={`/tenants/${id}/workstations`} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form action={updateWorkstation.bind(null, id, workstation.id)} className="xl:col-span-2">
          <Card className="space-y-5">
            <h2 className="font-semibold text-gray-900">Arbeitsplatzdaten</h2>
            <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput label="Name" name="name" defaultValue={workstation.name} required />
                <TextInput label="Raum" name="room" defaultValue={workstation.room} />
                <TextInput label="Netzwerkdose" name="networkOutlet" defaultValue={workstation.networkOutlet} />
                <TextInput label="IP-Adresse" name="ipAddress" defaultValue={workstation.ipAddress} />
                <TextInput label="Externe Referenz" name="externalRef" defaultValue={workstation.externalRef} />
                <SelectInput label="Standort" name="locationId" defaultValue={workstation.locationId} options={[{ value: "", label: "Kein Standort" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
                <SelectInput label="Mitarbeiter" name="employeeId" defaultValue={workstation.employeeId} options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]} />
              </div>
              <Textarea label="Notizen" name="notes" defaultValue={workstation.notes} />
            </fieldset>
            {canEdit && <div className="flex justify-end"><SubmitButton>Änderungen speichern</SubmitButton></div>}
          </Card>
        </form>
        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Zusammenfassung</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-400">Standort</dt><dd>{workstation.location?.name ?? "—"}</dd></div>
              <div><dt className="text-gray-400">Mitarbeiter</dt><dd>{workstation.employee ? `${workstation.employee.firstName} ${workstation.employee.lastName}` : "—"}</dd></div>
              <div><dt className="text-gray-400">Geräte</dt><dd>{workstation.devices.length}</dd></div>
            </dl>
          </Card>
          {canEdit && (
            <form action={deleteWorkstation.bind(null, id, workstation.id)}>
              <Card className="border-red-100 bg-red-50/50">
                <h2 className="font-semibold text-red-900 mb-2">Arbeitsplatz löschen</h2>
                <p className="text-sm text-red-700 mb-3">Entfernt den Arbeitsplatz dauerhaft.</p>
                <DeleteButton>Arbeitsplatz löschen</DeleteButton>
              </Card>
            </form>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Geräte</h2>
          <div className="space-y-2">
            {workstation.devices.length === 0 && <p className="text-sm text-gray-400">Keine Geräte</p>}
            {workstation.devices.map((d) => (
              <Link key={d.id} href={`/tenants/${id}/devices/${d.id}`} className="block text-sm rounded-lg border border-gray-100 p-3 hover:border-blue-300">
                <span className="font-medium text-gray-900">{[d.manufacturer, d.model].filter(Boolean).join(" ") || d.type}</span>
                <span className="ml-2 text-xs text-gray-400">{d.status}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Tickets</h2>
          <div className="space-y-2">
            {workstation.tickets.length === 0 && <p className="text-sm text-gray-400">Keine Tickets</p>}
            {workstation.tickets.map((t) => (
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
