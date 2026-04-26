import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { deleteEmployee, updateEmployee } from "../../_actions";
import { Card, DeleteButton, PageHeader, SelectInput, SubmitButton, TextInput, Textarea, formatInputDate } from "../../_components/form-controls";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string; employeeId: string }>;
}) {
  const { id, employeeId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewEmployees(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const [tenant, employee, locations] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.employee.findFirst({
      where: { id: employeeId, tenantId: id },
      include: {
        location: { select: { id: true, name: true } },
        workstation: { select: { id: true, name: true, room: true } },
        devices: { select: { id: true, type: true, manufacturer: true, model: true, status: true } },
        software: { include: { software: { select: { id: true, name: true, version: true } } } },
        credentials: { select: { id: true, name: true, username: true, category: true, expiresAt: true } },
        tickets: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, title: true, status: true, createdAt: true } },
      },
    }),
    prisma.location.findMany({ where: { tenantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!tenant || !employee) notFound();
  const canEdit = can.manageEmployees(ctx.role);

  return (
    <div className="space-y-5">
      <PageHeader
        tenantId={id}
        tenantName={tenant.name}
        section="Mitarbeiter"
        title={`${employee.firstName} ${employee.lastName}`}
        subtitle={`Erstellt am ${formatDate(employee.createdAt)}`}
        backHref={`/tenants/${id}/employees`}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form action={updateEmployee.bind(null, id, employee.id)} className="xl:col-span-2">
          <Card className="space-y-5">
            <h2 className="font-semibold text-gray-900">Stammdaten</h2>
            <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput label="Vorname" name="firstName" defaultValue={employee.firstName} required />
                <TextInput label="Nachname" name="lastName" defaultValue={employee.lastName} required />
                <TextInput label="E-Mail" name="email" type="email" defaultValue={employee.email} />
                <TextInput label="Telefon" name="phone" defaultValue={employee.phone} />
                <TextInput label="Mobil" name="mobile" defaultValue={employee.mobile} />
                <TextInput label="Position" name="position" defaultValue={employee.position} />
                <TextInput label="Abteilung" name="department" defaultValue={employee.department} />
                <SelectInput
                  label="Standort"
                  name="locationId"
                  defaultValue={employee.locationId}
                  options={[{ value: "", label: "Kein Standort" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
                />
                <SelectInput
                  label="Status"
                  name="status"
                  defaultValue={employee.status}
                  options={[
                    { value: "ACTIVE", label: "Aktiv" },
                    { value: "DISABLED", label: "Deaktiviert" },
                    { value: "LEFT", label: "Ausgeschieden" },
                  ]}
                />
                <TextInput label="Externe Referenz" name="externalRef" defaultValue={employee.externalRef} />
                <TextInput label="Startdatum" name="startDate" type="date" defaultValue={formatInputDate(employee.startDate)} />
                <TextInput label="Enddatum" name="endDate" type="date" defaultValue={formatInputDate(employee.endDate)} />
              </div>
              <Textarea label="Notizen" name="notes" defaultValue={employee.notes} />
            </fieldset>
            {canEdit && (
              <div className="flex justify-end">
                <SubmitButton>Änderungen speichern</SubmitButton>
              </div>
            )}
          </Card>
        </form>

        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Zuweisungen</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-400">Standort</dt><dd>{employee.location?.name ?? "—"}</dd></div>
              <div><dt className="text-gray-400">Arbeitsplatz</dt><dd>{employee.workstation ? employee.workstation.name : "—"}</dd></div>
              <div><dt className="text-gray-400">Geräte</dt><dd>{employee.devices.length}</dd></div>
              <div><dt className="text-gray-400">Software</dt><dd>{employee.software.length}</dd></div>
              <div><dt className="text-gray-400">Zugangsdaten</dt><dd>{employee.credentials.length}</dd></div>
            </dl>
          </Card>

          {canEdit && (
            <form action={deleteEmployee.bind(null, id, employee.id)}>
              <Card className="border-red-100 bg-red-50/50">
                <h2 className="font-semibold text-red-900 mb-2">Mitarbeiter löschen</h2>
                <p className="text-sm text-red-700 mb-3">Entfernt den Mitarbeiter dauerhaft. Zugeordnete Geräte bleiben erhalten und werden getrennt.</p>
                <DeleteButton>Mitarbeiter löschen</DeleteButton>
              </Card>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Geräte</h2>
          <div className="space-y-2">
            {employee.devices.length === 0 && <p className="text-sm text-gray-400">Keine Geräte zugeordnet</p>}
            {employee.devices.map((d) => (
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
            {employee.tickets.length === 0 && <p className="text-sm text-gray-400">Keine Tickets</p>}
            {employee.tickets.map((t) => (
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
