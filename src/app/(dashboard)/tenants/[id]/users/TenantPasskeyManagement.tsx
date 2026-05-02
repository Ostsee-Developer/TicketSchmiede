"use client";

import { useState } from "react";
import { KeyRound, Mail, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { decodeCreationOptions, encodeRegistrationCredential } from "@/lib/browser-webauthn";
import { formatDateTime } from "@/lib/utils";

interface TenantPasskeyUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  passkeys: { id: string; name: string | null; createdAt: Date | string; lastUsedAt: Date | string | null }[];
}

export function TenantPasskeyManagement({
  tenantId,
  initialUsers,
}: {
  tenantId: string;
  initialUsers: TenantPasskeyUser[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    const payload = await fetch(`/api/passkeys/users?tenantId=${tenantId}`).then((response) => response.json());
    if (payload.success) setUsers(payload.data);
  };

  const createPasskey = async (user: TenantPasskeyUser) => {
    if (!window.PublicKeyCredential) {
      setError("Dieser Browser unterstützt Passkeys nicht.");
      return;
    }

    setBusy(`create-${user.id}`);
    setError(null);
    try {
      const optionsPayload = await fetch(`/api/passkeys/users/${user.id}/register-options?tenantId=${tenantId}`, {
        method: "POST",
      }).then((response) => response.json());
      if (!optionsPayload.success) throw new Error(optionsPayload.error ?? "Passkey konnte nicht vorbereitet werden.");

      const credential = await navigator.credentials.create({
        publicKey: decodeCreationOptions(optionsPayload.data.options),
      });
      if (!credential) throw new Error("Passkey-Erstellung wurde abgebrochen.");

      const registerPayload = await fetch(`/api/passkeys/users/${user.id}/register?tenantId=${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Techniker-Passkey",
          credential: encodeRegistrationCredential(credential as PublicKeyCredential),
        }),
      }).then((response) => response.json());
      if (!registerPayload.success) throw new Error(registerPayload.error ?? "Passkey konnte nicht gespeichert werden.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey-Erstellung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const resetPasskeys = async (user: TenantPasskeyUser, email = false) => {
    setBusy(`${email ? "email" : "reset"}-${user.id}`);
    setError(null);
    const url = email
      ? `/api/passkeys/users/${user.id}/email-reset?tenantId=${tenantId}`
      : `/api/passkeys/users/${user.id}?tenantId=${tenantId}`;
    const response = await fetch(url, { method: email ? "POST" : "DELETE" });
    const payload = await response.json().catch(() => ({}));
    setBusy(null);
    if (response.ok) await reload();
    else setError(payload.error ?? "Passkey-Reset fehlgeschlagen.");
  };

  const deletePasskey = async (user: TenantPasskeyUser, passkeyId: string) => {
    setBusy(passkeyId);
    await fetch(`/api/passkeys/users/${user.id}?tenantId=${tenantId}&passkeyId=${passkeyId}`, { method: "DELETE" });
    setBusy(null);
    await reload();
  };

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Benutzer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Passkeys</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-950">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  {user.passkeys.length === 0 ? (
                    <span className="text-xs text-gray-400">Keine Passkeys</span>
                  ) : (
                    <div className="space-y-1">
                      {user.passkeys.map((passkey) => (
                        <div key={passkey.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <KeyRound className="h-3.5 w-3.5 text-blue-500" />
                          <span>{passkey.name ?? "Passkey"}</span>
                          <span className="text-gray-400">{formatDateTime(passkey.createdAt)}</span>
                          <button
                            onClick={() => deletePasskey(user, passkey.id)}
                            disabled={busy === passkey.id}
                            className="text-gray-400 hover:text-red-600"
                            title="Passkey löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => createPasskey(user)} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300">
                      <Plus className="h-3.5 w-3.5" />
                      Erstellen
                    </button>
                    <button onClick={() => resetPasskeys(user)} disabled={busy !== null || user.passkeys.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                    <button onClick={() => resetPasskeys(user, true)} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                      <Mail className="h-3.5 w-3.5" />
                      E-Mail
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
