import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { safeDecrypt } from "@/lib/encryption";
import { formatDate } from "@/lib/utils";
import { deleteCredential, updateCredential } from "../../_actions";
import { Card, DeleteButton, PageHeader, SelectInput, SubmitButton, TextInput, Textarea, formatInputDate } from "../../_components/form-controls";

export default async function CredentialDetailPage({ params }: { params: Promise<{ id: string; credentialId: string }> }) {
  const { id, credentialId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");
  if (!can.viewCredentials(ctx.role)) redirect(`/tenants/${id}/dashboard`);

  const [tenant, credential, employees, devices] = await Promise.all([
    prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    prisma.credential.findFirst({
      where: { id: credentialId, tenantId: id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        device: { select: { id: true, type: true, manufacturer: true, model: true, hostname: true } },
      },
    }),
    prisma.employee.findMany({ where: { tenantId: id }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.device.findMany({ where: { tenantId: id, status: "ACTIVE" }, orderBy: [{ manufacturer: "asc" }], select: { id: true, type: true, manufacturer: true, model: true, hostname: true } }),
  ]);
  if (!tenant || !credential) notFound();
  const canEdit = can.manageCredentials(ctx.role);
  const decryptedNotes = canEdit ? safeDecrypt(credential.encryptedNotes) : null;

  return (
    <div className="space-y-5">
      <PageHeader tenantId={id} tenantName={tenant.name} section="Zugangsdaten" title={credential.name} subtitle={`Erstellt am ${formatDate(credential.createdAt)}`} backHref={`/tenants/${id}/credentials`} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form action={updateCredential.bind(null, id, credential.id)} className="xl:col-span-2">
          <Card className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">Allgemein</h2>
              <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-80">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput label="Name" name="name" defaultValue={credential.name} required />
                  <TextInput label="Kategorie" name="category" defaultValue={credential.category} />
                  <TextInput label="Benutzername" name="username" defaultValue={credential.username} />
                  <TextInput label="Neues Passwort" name="password" type="password" placeholder={credential.encryptedPassword ? "Leer lassen, um beizubehalten" : ""} />
                  <TextInput label="URL" name="url" type="url" defaultValue={credential.url} />
                  <TextInput label="Ablaufdatum" name="expiresAt" type="date" defaultValue={formatInputDate(credential.expiresAt)} />
                  <TextInput label="Externe Referenz" name="externalRef" defaultValue={credential.externalRef} />
                  <SelectInput
                    label="Mitarbeiter"
                    name="employeeId"
                    defaultValue={credential.employeeId}
                    options={[{ value: "", label: "Nicht zugewiesen" }, ...employees.map((e) => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))]}
                  />
                  <SelectInput
                    label="Gerät"
                    name="deviceId"
                    defaultValue={credential.deviceId}
                    options={[
                      { value: "", label: "Kein Gerät" },
                      ...devices.map((d) => ({ value: d.id, label: [d.manufacturer, d.model, d.hostname].filter(Boolean).join(" – ") || d.type })),
                    ]}
                  />
                </div>
                <Textarea label="Verschlüsselte Notizen" name="notes" defaultValue={decryptedNotes} />
              </fieldset>
            </div>

            <div>
              <h2 className="font-semibold text-gray-900 mb-3">Fernzugang (RustDesk)</h2>
              <fieldset disabled={!canEdit} className="disabled:opacity-80">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput label="RustDesk ID" name="rustdeskId" defaultValue={credential.rustdeskId} />
                  <TextInput
                    label="RustDesk Passwort"
                    name="rustdeskPassword"
                    type="password"
                    placeholder={credential.encryptedRustdeskPassword ? "Leer lassen, um beizubehalten" : ""}
                  />
                </div>
              </fieldset>
            </div>

            <div>
              <h2 className="font-semibold text-gray-900 mb-3">Fernzugang (TeamViewer)</h2>
              <fieldset disabled={!canEdit} className="disabled:opacity-80">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput label="TeamViewer ID" name="teamviewerId" defaultValue={credential.teamviewerId} />
                  <TextInput
                    label="TeamViewer Passwort"
                    name="teamviewerPassword"
                    type="password"
                    placeholder={credential.encryptedTeamviewerPassword ? "Leer lassen, um beizubehalten" : ""}
                  />
                </div>
              </fieldset>
            </div>

            {canEdit && <div className="flex justify-end"><SubmitButton>Änderungen speichern</SubmitButton></div>}
          </Card>
        </form>

        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Status</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-400">Mitarbeiter</dt>
                <dd>{credential.employee ? `${credential.employee.firstName} ${credential.employee.lastName}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Gerät</dt>
                <dd>{credential.device ? [credential.device.manufacturer, credential.device.model].filter(Boolean).join(" ") || credential.device.type : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Passwort vorhanden</dt>
                <dd>{credential.encryptedPassword ? "✓ Ja" : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">RustDesk</dt>
                <dd>{credential.rustdeskId ? `ID: ${credential.rustdeskId}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">TeamViewer</dt>
                <dd>{credential.teamviewerId ? `ID: ${credential.teamviewerId}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Ablaufdatum</dt>
                <dd>{formatDate(credential.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Zuletzt rotiert</dt>
                <dd>{formatDate(credential.lastRotatedAt)}</dd>
              </div>
            </dl>
          </Card>
          {canEdit && (
            <form action={deleteCredential.bind(null, id, credential.id)}>
              <Card className="border-red-100 bg-red-50/50">
                <h2 className="font-semibold text-red-900 mb-2">Zugangsdaten löschen</h2>
                <p className="text-sm text-red-700 mb-3">Entfernt diesen Eintrag dauerhaft.</p>
                <DeleteButton>Zugangsdaten löschen</DeleteButton>
              </Card>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// suppress unused import warning
void formatInputDate;
