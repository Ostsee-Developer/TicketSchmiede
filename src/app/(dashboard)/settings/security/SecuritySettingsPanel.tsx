"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCheck,
  Copy,
  KeyRound,
  Plus,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { decodeCreationOptions, encodeRegistrationCredential } from "@/lib/browser-webauthn";

interface SetupData {
  secret: string;
  qrDataUrl: string;
  backupCodes: string[];
  alreadyEnabled: boolean;
}

interface Passkey {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

type Step = "overview" | "setup" | "backup" | "done" | "disable";

export function SecuritySettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const [step, setStep] = useState<Step>("overview");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([load2Fa(), loadPasskeys()]).finally(() => setLoading(false));
  }, []);

  const load2Fa = async () => {
    const payload = await fetch("/api/auth/2fa/setup").then((response) => response.json());
    if (payload.success) {
      setSetupData(payload.data);
      setTwoFaEnabled(payload.data.alreadyEnabled);
    }
  };

  const loadPasskeys = async () => {
    const payload = await fetch("/api/auth/passkey/list").then((response) => response.json());
    if (payload.success) setPasskeys(payload.data);
  };

  const startSetup = async () => {
    setError(null);
    setLoading(true);
    await load2Fa();
    setStep("setup");
    setLoading(false);
  };

  const confirmToken = async () => {
    if (!setupData || token.length !== 6) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: setupData.secret, token, backupCodes: setupData.backupCodes }),
    }).then((response) => response.json());

    if (res.success) {
      setStep("backup");
    } else {
      setError(res.errors?.token?.[0] ?? res.error ?? "Ungültiger Code.");
    }
    setSubmitting(false);
  };

  const disable2FA = async () => {
    if (!password || token.length !== 6) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, token }),
    }).then((response) => response.json());

    if (res.success) {
      setTwoFaEnabled(false);
      setStep("overview");
      setPassword("");
      setToken("");
    } else {
      setError(res.error ?? "Deaktivierung fehlgeschlagen.");
    }
    setSubmitting(false);
  };

  const copyBackupCodes = async () => {
    if (!setupData) return;
    await navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const registerPasskey = async () => {
    if (!window.PublicKeyCredential) {
      setError("Dieser Browser unterstützt Passkeys nicht.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const optionsPayload = await fetch("/api/auth/passkey/register-options", { method: "POST" }).then((response) =>
        response.json()
      );
      if (!optionsPayload.success) throw new Error(optionsPayload.error ?? "Passkey konnte nicht vorbereitet werden.");

      const credential = await navigator.credentials.create({
        publicKey: decodeCreationOptions(optionsPayload.data.options),
      });
      if (!credential) throw new Error("Passkey-Registrierung wurde abgebrochen.");

      const registerPayload = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Passkey",
          credential: encodeRegistrationCredential(credential as PublicKeyCredential),
        }),
      }).then((response) => response.json());

      if (!registerPayload.success) throw new Error(registerPayload.error ?? "Passkey konnte nicht gespeichert werden.");
      await loadPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey-Registrierung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  const deletePasskey = async (id: string) => {
    await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
    setPasskeys((items) => items.filter((item) => item.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "max-w-4xl space-y-6"}>
      {!embedded && (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sicherheitseinstellungen</h1>
        <p className="text-gray-500 mt-1">Verwalte deine 2FA und persönlichen Passkeys.</p>
      </div>
      )}

      {embedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Sicherheit</h2>
          <p className="text-gray-500 mt-1">Verwalte deine 2FA und persÃ¶nlichen Passkeys.</p>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {step === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${twoFaEnabled ? "bg-green-100" : "bg-gray-100"}`}>
                {twoFaEnabled ? <ShieldCheck className="w-6 h-6 text-green-600" /> : <ShieldOff className="w-6 h-6 text-gray-400" />}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">Zwei-Faktor-Authentifizierung</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {twoFaEnabled ? "2FA ist aktiviert." : "2FA ist deaktiviert. Aktiviere es für mehr Kontosicherheit."}
                </p>
                <div className="mt-4">
                  {twoFaEnabled ? (
                    <button onClick={() => setStep("disable")} className="text-sm text-red-600 hover:text-red-800 font-medium">
                      2FA deaktivieren
                    </button>
                  ) : (
                    <button onClick={startSetup} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                      2FA einrichten
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
                <KeyRound className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">Passkeys</h2>
                <p className="text-sm text-gray-500 mt-1">Melde dich ohne Passwort mit Geräte-PIN, Fingerabdruck oder Sicherheitsschlüssel an.</p>
                <button
                  onClick={registerPasskey}
                  disabled={submitting}
                  className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Passkey hinzufügen
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {passkeys.length === 0 ? (
                <p className="text-sm text-gray-500">Noch kein Passkey eingerichtet.</p>
              ) : (
                passkeys.map((passkey) => (
                  <div key={passkey.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{passkey.name ?? "Passkey"}</p>
                      <p className="text-xs text-gray-500">
                        Erstellt am {new Date(passkey.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <button onClick={() => deletePasskey(passkey.id)} className="p-2 text-gray-400 hover:text-red-600" title="Passkey löschen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {step === "setup" && setupData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="font-semibold text-gray-900">QR-Code scannen</h2>
          </div>
          <div className="flex justify-center">
            <div className="p-3 border border-gray-200 rounded-xl bg-white">
              <Image src={setupData.qrDataUrl} alt="2FA QR Code" width={180} height={180} />
            </div>
          </div>
          <code className="block bg-gray-50 rounded-lg p-3 text-sm font-mono text-gray-800 break-all">{setupData.secret}</code>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <button onClick={() => setStep("overview")} className="text-sm text-gray-500 hover:text-gray-700">
              Abbrechen
            </button>
            <button
              onClick={confirmToken}
              disabled={token.length !== 6 || submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2 rounded-lg"
            >
              {submitting ? "Prüfen..." : "Bestätigen"}
            </button>
          </div>
        </div>
      )}

      {step === "backup" && setupData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <div className="flex items-center gap-3">
            <CheckCheck className="w-6 h-6 text-green-600" />
            <h2 className="font-semibold text-gray-900">Backup-Codes sichern</h2>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">Speichere diese Codes sicher. Jeder Code kann nur einmal verwendet werden.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {setupData.backupCodes.map((code) => (
              <code key={code} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center text-gray-800">
                {code}
              </code>
            ))}
          </div>
          <button onClick={copyBackupCodes} className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
            {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "Kopiert" : "Alle Codes kopieren"}
          </button>
          <button onClick={() => { setTwoFaEnabled(true); setStep("done"); }} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg">
            Codes gespeichert
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-4 max-w-2xl">
          <ShieldCheck className="w-10 h-10 text-green-600 mx-auto" />
          <h2 className="font-bold text-gray-900 text-lg">2FA erfolgreich aktiviert</h2>
          <button onClick={() => setStep("overview")} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded-lg">
            Zur Übersicht
          </button>
        </div>
      )}

      {step === "disable" && (
        <div className="bg-white rounded-xl border border-red-200 p-6 space-y-5 max-w-2xl">
          <div className="flex items-center gap-3">
            <ShieldOff className="w-6 h-6 text-red-500" />
            <h2 className="font-semibold text-gray-900">2FA deaktivieren</h2>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Aktuelles Passwort"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <button onClick={() => setStep("overview")} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
              Abbrechen
            </button>
            <button
              onClick={disable2FA}
              disabled={!password || token.length !== 6 || submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium py-2 rounded-lg"
            >
              {submitting ? "Deaktivieren..." : "2FA deaktivieren"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
