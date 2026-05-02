"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  CircleOff,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { decodeCreationOptions, encodeRegistrationCredential } from "@/lib/browser-webauthn";

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INTERNAL_ADMIN: "Interner Admin",
  TECHNICIAN: "Techniker",
  CUSTOMER_ADMIN: "Kunden-Admin",
  CUSTOMER_USER: "Kunden-Benutzer",
  READ_ONLY: "Nur Lesen",
};

const roleBadge: Record<string, string> = {
  SUPER_ADMIN: "border-red-200 bg-red-50 text-red-700",
  INTERNAL_ADMIN: "border-blue-200 bg-blue-50 text-blue-700",
  TECHNICIAN: "border-violet-200 bg-violet-50 text-violet-700",
  CUSTOMER_ADMIN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CUSTOMER_USER: "border-gray-200 bg-gray-50 text-gray-600",
  READ_ONLY: "border-amber-200 bg-amber-50 text-amber-700",
};

interface TenantRole {
  id: string;
  role: string;
  tenant: { id: string; name: string };
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | string | null;
  createdAt: Date | string;
  tenantRoles: TenantRole[];
  passkeys?: { id: string; name: string | null; createdAt: Date | string; lastUsedAt: Date | string | null }[];
}

const createSchema = z.object({
  name: z.string().min(2, "Mindestens 2 Zeichen").max(100),
  email: z.string().email("Ungültige E-Mail"),
  password: z.string().min(12, "Mindestens 12 Zeichen"),
  isSuperAdmin: z.boolean().default(false),
});

const editSchema = z.object({
  name: z.string().min(2, "Mindestens 2 Zeichen").max(100),
  email: z.string().email("Ungültige E-Mail"),
  password: z.string().min(12, "Mindestens 12 Zeichen").or(z.literal("")).optional(),
  isActive: z.boolean(),
  isSuperAdmin: z.boolean(),
});

const roleAssignSchema = z.object({
  tenantId: z.string().min(1, "Mandant wählen"),
  role: z.enum(["INTERNAL_ADMIN", "TECHNICIAN", "CUSTOMER_ADMIN", "CUSTOMER_USER", "READ_ONLY"]),
});

type CreateData = z.infer<typeof createSchema>;
type EditData = z.infer<typeof editSchema>;
type RoleAssignData = z.infer<typeof roleAssignSchema>;
type ModalState =
  | "create"
  | { type: "edit"; user: User }
  | { type: "roles"; user: User }
  | { type: "passkeys"; user: User }
  | null;
type StatusFilter = "all" | "active" | "inactive" | "locked" | "2fa";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function UserManagement({ users, tenants }: { users: User[]; tenants: Tenant[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const stats = useMemo(() => {
    const locked = users.filter(isLocked).length;
    return {
      total: users.length,
      active: users.filter((user) => user.isActive && !isLocked(user)).length,
      locked,
      twoFactor: users.filter((user) => user.twoFactorEnabled).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      const haystack = [
        user.name,
        user.email,
        user.isSuperAdmin ? "Super Admin" : "",
        ...user.tenantRoles.flatMap((tenantRole) => [
          roleLabel[tenantRole.role] ?? tenantRole.role,
          tenantRole.tenant.name,
        ]),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = needle.length === 0 || haystack.includes(needle);
      const matchesStatus =
        status === "all" ||
        (status === "active" && user.isActive && !isLocked(user)) ||
        (status === "inactive" && !user.isActive) ||
        (status === "locked" && isLocked(user)) ||
        (status === "2fa" && user.twoFactorEnabled);

      return matchesQuery && matchesStatus;
    });
  }, [query, status, users]);

  const refresh = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <>
      {modal === "create" && <CreateModal onClose={() => setModal(null)} onSuccess={refresh} />}
      {modal !== null && modal !== "create" && modal.type === "edit" && (
        <EditModal user={modal.user} onClose={() => setModal(null)} onSuccess={refresh} />
      )}
      {modal !== null && modal !== "create" && modal.type === "roles" && (
        <RoleModal user={modal.user} tenants={tenants} onClose={() => setModal(null)} onSuccess={refresh} />
      )}
      {modal !== null && modal !== "create" && modal.type === "passkeys" && (
        <PasskeyModal user={modal.user} onClose={() => setModal(null)} onSuccess={refresh} />
      )}

      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Administration</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-950">Benutzer & Rechte</h1>
            <p className="mt-1 text-sm text-gray-500">Konten, Mandantenrollen und Sicherheitsstatus zentral verwalten.</p>
          </div>
          <button
            onClick={() => setModal("create")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Neuer Benutzer
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Benutzer" value={stats.total} />
          <StatCard icon={CheckCircle2} label="Aktiv" value={stats.active} />
          <StatCard icon={Lock} label="Gesperrt" value={stats.locked} />
          <StatCard icon={ShieldCheck} label="2FA aktiv" value={stats.twoFactor} />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block lg:max-w-md lg:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nach Name, E-Mail, Rolle oder Mandant suchen"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {[
                ["all", "Alle"],
                ["active", "Aktiv"],
                ["inactive", "Inaktiv"],
                ["locked", "Gesperrt"],
                ["2fa", "2FA"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value as StatusFilter)}
                  className={`h-10 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    status === value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <UserRoundCog className="mx-auto h-10 w-10 text-gray-300" />
            <h2 className="mt-3 text-sm font-semibold text-gray-900">Keine passenden Benutzer</h2>
            <p className="mt-1 text-sm text-gray-500">Passe Suche oder Filter an.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:hidden">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onEdit={() => setModal({ type: "edit", user })}
                  onRoles={() => setModal({ type: "roles", user })}
                  onPasskeys={() => setModal({ type: "passkeys", user })}
                />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Benutzer</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Rollen / Mandanten</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">2FA</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Passkeys</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Letzter Login</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <UserIdentity user={user} />
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadges user={user} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {user.twoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Aktiv
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-medium text-gray-600">
                          {user.passkeys?.length ?? 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Noch nie"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge user={user} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <IconButton label="Rollen" onClick={() => setModal({ type: "roles", user })}>
                              <KeyRound className="h-4 w-4" />
                            </IconButton>
                            <IconButton label="Passkeys" onClick={() => setModal({ type: "passkeys", user })}>
                              <ShieldCheck className="h-4 w-4" />
                            </IconButton>
                            <IconButton label="Bearbeiten" onClick={() => setModal({ type: "edit", user })}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { isSuperAdmin: false },
  });

  const onSubmit = async (data: CreateData) => {
    setServerError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) onSuccess();
    else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <ModalWrapper title="Neuer Benutzer" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ServerError message={serverError} />
        <Field label="Name" error={errors.name?.message}>
          <input {...register("name")} type="text" placeholder="Max Mustermann" className={inputCls} />
        </Field>
        <Field label="E-Mail" error={errors.email?.message}>
          <input {...register("email")} type="email" placeholder="max@firma.de" className={inputCls} />
        </Field>
        <Field label="Passwort (min. 12 Zeichen)" error={errors.password?.message}>
          <input {...register("password")} type="password" placeholder="Mindestens 12 Zeichen" className={inputCls} />
        </Field>
        <CheckboxLabel label="Super Admin">
          <input {...register("isSuperAdmin")} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" />
        </CheckboxLabel>
        <ModalActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Benutzer anlegen" />
      </form>
    </ModalWrapper>
  );
}

function EditModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      password: "",
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
    },
  });

  const onSubmit = async (data: EditData) => {
    setServerError(null);
    const payload: Record<string, unknown> = {
      name: data.name,
      email: data.email,
      isActive: data.isActive,
      isSuperAdmin: data.isSuperAdmin,
    };
    if (data.password) payload.password = data.password;

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) onSuccess();
    else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <ModalWrapper title={`Benutzer bearbeiten - ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ServerError message={serverError} />
        <Field label="Name" error={errors.name?.message}>
          <input {...register("name")} type="text" className={inputCls} />
        </Field>
        <Field label="E-Mail" error={errors.email?.message}>
          <input {...register("email")} type="email" className={inputCls} />
        </Field>
        <Field label="Neues Passwort (leer lassen = unverändert)" error={errors.password?.message}>
          <input {...register("password")} type="password" placeholder="Optional" className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxLabel label="Aktiv">
            <input {...register("isActive")} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" />
          </CheckboxLabel>
          <CheckboxLabel label="Super Admin">
            <input {...register("isSuperAdmin")} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" />
          </CheckboxLabel>
        </div>
        <ModalActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Speichern" />
      </form>
    </ModalWrapper>
  );
}

function RoleModal({
  user,
  tenants,
  onClose,
  onSuccess,
}: {
  user: User;
  tenants: Tenant[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<RoleAssignData>({
    resolver: zodResolver(roleAssignSchema),
    defaultValues: { role: "TECHNICIAN" },
  });

  const onSubmit = async (data: RoleAssignData) => {
    setServerError(null);
    const res = await fetch(`/api/users/${user.id}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      reset({ role: "TECHNICIAN", tenantId: "" });
      onSuccess();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  const removeRole = async (tenantId: string) => {
    setRemoving(tenantId);
    const res = await fetch(`/api/users/${user.id}/roles?tenantId=${tenantId}`, { method: "DELETE" });
    setRemoving(null);
    if (res.ok) onSuccess();
    else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Entfernen");
    }
  };

  const availableTenants = tenants.filter((tenant) => !user.tenantRoles.some((role) => role.tenant.id === tenant.id));

  return (
    <ModalWrapper title={`Rollen - ${user.name}`} onClose={onClose} wide>
      <div className="space-y-5">
        <ServerError message={serverError} />

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Aktuelle Rollen</p>
          {user.tenantRoles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Keine Mandanten-Rollen
            </p>
          ) : (
            <ul className="space-y-2">
              {user.tenantRoles.map((tenantRole) => (
                <li
                  key={tenantRole.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <RolePill role={tenantRole.role} />
                    <p className="mt-1 truncate text-sm font-medium text-gray-800">{tenantRole.tenant.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRole(tenantRole.tenant.id)}
                    disabled={removing === tenantRole.tenant.id}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    {removing === tenantRole.tenant.id ? "Entferne..." : "Entfernen"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {availableTenants.length > 0 && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700">Neue Rolle zuweisen</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mandant" error={errors.tenantId?.message}>
                <select {...register("tenantId")} className={inputCls}>
                  <option value="">Mandant wählen...</option>
                  {availableTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rolle" error={errors.role?.message}>
                <select {...register("role")} className={inputCls}>
                  <option value="INTERNAL_ADMIN">Interner Admin</option>
                  <option value="TECHNICIAN">Techniker</option>
                  <option value="CUSTOMER_ADMIN">Kunden-Admin</option>
                  <option value="CUSTOMER_USER">Kunden-Benutzer</option>
                  <option value="READ_ONLY">Nur Lesen</option>
                </select>
              </Field>
            </div>
            <ModalActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Rolle zuweisen" />
          </form>
        )}
      </div>
    </ModalWrapper>
  );
}

function PasskeyModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const createPasskey = async () => {
    if (!window.PublicKeyCredential) {
      setServerError("Dieser Browser unterstützt Passkeys nicht.");
      return;
    }

    setBusy("create");
    setServerError(null);
    try {
      const optionsPayload = await fetch(`/api/passkeys/users/${user.id}/register-options`, { method: "POST" }).then((r) =>
        r.json()
      );
      if (!optionsPayload.success) throw new Error(optionsPayload.error ?? "Passkey konnte nicht vorbereitet werden.");

      const credential = await navigator.credentials.create({
        publicKey: decodeCreationOptions(optionsPayload.data.options),
      });
      if (!credential) throw new Error("Passkey-Erstellung wurde abgebrochen.");

      const registerPayload = await fetch(`/api/passkeys/users/${user.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Verwalteter Passkey",
          credential: encodeRegistrationCredential(credential as PublicKeyCredential),
        }),
      }).then((r) => r.json());
      if (!registerPayload.success) throw new Error(registerPayload.error ?? "Passkey konnte nicht gespeichert werden.");
      onSuccess();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Passkey-Erstellung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const resetPasskeys = async (email = false) => {
    setBusy(email ? "email" : "reset");
    setServerError(null);
    const url = email ? `/api/passkeys/users/${user.id}/email-reset` : `/api/passkeys/users/${user.id}`;
    const response = await fetch(url, { method: email ? "POST" : "DELETE" });
    const payload = await response.json().catch(() => ({}));
    setBusy(null);
    if (response.ok) onSuccess();
    else setServerError(payload.error ?? "Passkey-Reset fehlgeschlagen.");
  };

  const deletePasskey = async (passkeyId: string) => {
    setBusy(passkeyId);
    const response = await fetch(`/api/passkeys/users/${user.id}?passkeyId=${passkeyId}`, { method: "DELETE" });
    setBusy(null);
    if (response.ok) onSuccess();
  };

  return (
    <ModalWrapper title={`Passkeys - ${user.name}`} onClose={onClose} wide>
      <div className="space-y-5">
        <ServerError message={serverError} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createPasskey}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            <Plus className="h-4 w-4" />
            Passkey erstellen
          </button>
          <button
            type="button"
            onClick={() => resetPasskeys(false)}
            disabled={busy !== null || (user.passkeys?.length ?? 0) === 0}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <RefreshCcw className="h-4 w-4" />
            Zurücksetzen
          </button>
          <button
            type="button"
            onClick={() => resetPasskeys(true)}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Mail className="h-4 w-4" />
            Per E-Mail resetten
          </button>
        </div>

        <div className="space-y-2">
          {(user.passkeys?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Keine Passkeys eingerichtet.
            </p>
          ) : (
            user.passkeys?.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{passkey.name ?? "Passkey"}</p>
                  <p className="text-xs text-gray-500">Erstellt: {formatDateTime(passkey.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deletePasskey(passkey.id)}
                  disabled={busy === passkey.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Passkey löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function UserCard({
  user,
  onEdit,
  onRoles,
  onPasskeys,
}: {
  user: User;
  onEdit: () => void;
  onRoles: () => void;
  onPasskeys: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity user={user} />
        <StatusBadge user={user} />
      </div>
      <div className="mt-3">
        <RoleBadges user={user} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Noch nie angemeldet"}</span>
        {user.twoFactorEnabled ? <span className="font-medium text-emerald-700">2FA aktiv</span> : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={onRoles} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">
          <KeyRound className="h-4 w-4" />
          Rollen
        </button>
        <button onClick={onPasskeys} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">
          <ShieldCheck className="h-4 w-4" />
          Keys
        </button>
        <button onClick={onEdit} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </button>
      </div>
    </div>
  );
}

function UserIdentity({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">
        {initials(user.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-950">{user.name}</p>
        <p className="truncate text-xs text-gray-500">{user.email}</p>
      </div>
    </div>
  );
}

function RoleBadges({ user }: { user: User }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.isSuperAdmin ? <RolePill role="SUPER_ADMIN" /> : null}
      {user.tenantRoles.map((tenantRole) => (
        <RolePill key={tenantRole.id} role={tenantRole.role} suffix={tenantRole.tenant.name} />
      ))}
      {!user.isSuperAdmin && user.tenantRoles.length === 0 ? (
        <span className="text-xs text-gray-400">Keine Rollen</span>
      ) : null}
    </div>
  );
}

function RolePill({ role, suffix }: { role: string; suffix?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge[role] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
      <span className="truncate">{roleLabel[role] ?? role}{suffix ? ` @ ${suffix}` : ""}</span>
    </span>
  );
}

function StatusBadge({ user }: { user: User }) {
  if (isLocked(user)) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><Lock className="h-3.5 w-3.5" />Gesperrt</span>;
  }
  if (user.isActive) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Aktiv</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"><CircleOff className="h-3.5 w-3.5" />Inaktiv</span>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      {children}
    </button>
  );
}

function ModalWrapper({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="min-w-0 truncate text-lg font-semibold text-gray-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-4.5rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, isSubmitting, submitLabel }: { onClose: () => void; isSubmitting: boolean; submitLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
        Abbrechen
      </button>
      <button type="submit" disabled={isSubmitting} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400">
        {isSubmitting ? "Speichern..." : submitLabel}
      </button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function CheckboxLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">
      {children}
      {label}
    </label>
  );
}

function ServerError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function isLocked(user: User) {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());
}
