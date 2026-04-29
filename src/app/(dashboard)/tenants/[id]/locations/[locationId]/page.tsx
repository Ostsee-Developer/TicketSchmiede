import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { updateLocation, deleteLocation } from "../../_actions";
import {
  Card,
  PageHeader,
  SubmitButton,
  DeleteButton,
  TextInput,
  Textarea,
  formatInputDate,
} from "../../_components/form-controls";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locationId: string }>;
}) {
  const { id, locationId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewDevices(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const [tenant, location] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.location.findFirst({
      where: { id: locationId, tenantId: id },
      include: {
        employees: { select: { id: true, firstName: true, lastName: true, status: true } },
        devices: { select: { id: true, type: true, manufacturer: true, model: true } },
        workstations: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!tenant) notFound();
  if (!location) notFound();

  const canManage = can.manageDevices(ctx.role);

  return (
    <div className="space-y-5">
      <PageHeader
        tenantId={id}
        tenantName={tenant.name}
        section="Standorte"
        title={location.name}
        backHref={`/tenants/${id}/locations`}
      />

      {canManage ? (
        <form action={updateLocation.bind(null, id, locationId)}>
          <Card className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Name" name="name" defaultValue={location.name} required />
              <TextInput label="Straße" name="street" defaultValue={location.street} />
              <TextInput label="PLZ" name="zipCode" defaultValue={location.zipCode} />
              <TextInput label="Stadt" name="city" defaultValue={location.city} />
              <TextInput label="Land" name="country" defaultValue={location.country} />
            </div>
            <Textarea label="Notizen" name="notes" defaultValue={location.notes} />
            <div className="flex justify-between items-center">
              <form action={deleteLocation.bind(null, id, locationId)}>
                <DeleteButton>Standort löschen</DeleteButton>
              </form>
              <SubmitButton>Änderungen speichern</SubmitButton>
            </div>
          </Card>
        </form>
      ) : (
        <Card>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Name</dt>
              <dd className="text-gray-900 mt-1">{location.name}</dd>
            </div>
            {location.street && (
              <div>
                <dt className="font-medium text-gray-500">Adresse</dt>
                <dd className="text-gray-900 mt-1">
                  {location.street}<br />
                  {location.zipCode} {location.city}
                </dd>
              </div>
            )}
            {location.notes && (
              <div className="sm:col-span-2">
                <dt className="font-medium text-gray-500">Notizen</dt>
                <dd className="text-gray-900 mt-1 whitespace-pre-wrap">{location.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* Associated items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Mitarbeiter ({location.employees.length})</h3>
          {location.employees.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Mitarbeiter</p>
          ) : (
            <ul className="space-y-1">
              {location.employees.map((e) => (
                <li key={e.id} className="text-sm text-gray-700">{e.lastName}, {e.firstName}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Geräte ({location.devices.length})</h3>
          {location.devices.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Geräte</p>
          ) : (
            <ul className="space-y-1">
              {location.devices.map((d) => (
                <li key={d.id} className="text-sm text-gray-700">{d.manufacturer} {d.model} ({d.type})</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Arbeitsplätze ({location.workstations.length})</h3>
          {location.workstations.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Arbeitsplätze</p>
          ) : (
            <ul className="space-y-1">
              {location.workstations.map((w) => (
                <li key={w.id} className="text-sm text-gray-700">{w.name}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// suppress unused import warning - formatInputDate used for date fields when needed
void formatInputDate;
