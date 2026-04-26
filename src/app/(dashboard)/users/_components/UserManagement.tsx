"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDateTime } from "@/lib/utils";

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INTERNAL_ADMIN: "Interner Admin",
  TECHNICIAN: "Techniker",
  CUSTOMER_ADMIN: "Kunden-Admin",
  CUSTOMER_USER: "Kunden-Benutzer",
  READ_ONLY: "Nur Lesen",
};

const roleBadge: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  INTERNAL_ADMIN: "bg-blue-100 text-blue-700",
  TECHNICIAN: "bg-purple-100 text-purple-700",
  CUSTOMER_ADMIN: "bg-green-100 text-green-700",
  CUSTOMER_USER: "bg-gray-100 text-gray-600",
  READ_ONLY: "bg-yellow-100 text-yellow-700",
};

interface TenantRole {
  id: string;
  role: string;
  tenant: { name: string };
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

type CreateData = z.infer<typeof createSchema>;
type EditData = z.infer<typeof editSchema>;

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
    if (res.ok) {
      onSuccess();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <ModalWrapper title="Neuer Benutzer" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{serverError}</p>}
        <Field label="Name" error={errors.name?.message}>
          <input {...register("name")} type="text" placeholder="Max Mustermann" className={inputCls} />
        </Field>
        <Field label="E-Mail" error={errors.email?.message}>
          <input {...register("email")} type="email" placeholder="max@firma.de" className={inputCls} />
        </Field>
        <Field label="Passwort (min. 12 Zeichen)" error={errors.password?.message}>
          <input {...register("password")} type="password" placeholder="••••••••••••" className={inputCls} />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input {...register("isSuperAdmin")} type="checkbox" className="rounded border-gray-300" />
          <span className="text-sm text-gray-700">Super Admin</span>
        </label>
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
    if (res.ok) {
      onSuccess();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <ModalWrapper title={`Benutzer bearbeiten — ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{serverError}</p>}
        <Field label="Name" error={errors.name?.message}>
          <input {...register("name")} type="text" className={inputCls} />
        </Field>
        <Field label="E-Mail" error={errors.email?.message}>
          <input {...register("email")} type="email" className={inputCls} />
        </Field>
        <Field label="Neues Passwort (leer lassen = unverändert)" error={errors.password?.message}>
          <input {...register("password")} type="password" placeholder="••••••••••••" className={inputCls} />
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...register("isActive")} type="checkbox" className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Aktiv</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...register("isSuperAdmin")} type="checkbox" className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Super Admin</span>
          </label>
        </div>
        <ModalActions onClose={onClose} isSubmitting={isSubmitting} submitLabel="Speichern" />
      </form>
    </ModalWrapper>
  );
}

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, isSubmitting, submitLabel }: { onClose: () => void; isSubmitting: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        Abbrechen
      </button>
      <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-2">
        {isSubmitting ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Speichern...
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

export function UserManagement({ users }: { users: User[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<"create" | { type: "edit"; user: User } | null>(null);

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

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benutzer & Rechte</h1>
          <p className="text-gray-500 mt-1">{users.length} Benutzer</p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Benutzer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Benutzer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Rollen / Mandanten</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">2FA</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Letzter Login</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.isSuperAdmin && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge.SUPER_ADMIN}`}>
                        Super Admin
                      </span>
                    )}
                    {u.tenantRoles.map((tr) => (
                      <span key={tr.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[tr.role] ?? ""}`}>
                        {roleLabel[tr.role] ?? tr.role} @ {tr.tenant.name}
                      </span>
                    ))}
                    {!u.isSuperAdmin && u.tenantRoles.length === 0 && (
                      <span className="text-xs text-gray-400">Keine Rollen</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {u.twoFactorEnabled ? (
                    <span className="text-green-600 text-xs font-medium">Aktiv</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Noch nie"}
                </td>
                <td className="px-4 py-3 text-center">
                  {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Gesperrt</span>
                  ) : u.isActive ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Aktiv</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inaktiv</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setModal({ type: "edit", user: u })}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
