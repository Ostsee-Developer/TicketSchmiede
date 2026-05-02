"use client";

import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";

type LoginPolicy = "PASSWORD_AND_PASSKEY" | "PASSWORD_ONLY" | "PASSKEY_ONLY";

interface AppBrandingSettings {
  appName: string;
  loginSubtitle: string;
  loginHeadline: string;
  loginHighlight: string;
  loginDescription: string;
  loginFooter: string;
}

const policyLabels: Record<LoginPolicy, string> = {
  PASSWORD_AND_PASSKEY: "Passwort und Passkey",
  PASSWORD_ONLY: "Nur Passwort",
  PASSKEY_ONLY: "Nur Passkey",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function SystemSettingsClient({
  initialBranding,
  initialPolicy,
}: {
  initialBranding: AppBrandingSettings;
  initialPolicy: LoginPolicy;
}) {
  const [branding, setBranding] = useState(initialBranding);
  const [policy, setPolicy] = useState(initialPolicy);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveBranding = async () => {
    setSaving("branding");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(null);
    if (response.ok && payload.success) {
      setBranding(payload.data.branding);
      setMessage("Loginseite wurde aktualisiert.");
    } else {
      setError(payload.error ?? "Speichern fehlgeschlagen.");
    }
  };

  const savePolicy = async (nextPolicy: LoginPolicy) => {
    setSaving("policy");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings/login-policy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy: nextPolicy }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(null);
    if (response.ok && payload.success) {
      setPolicy(payload.data.policy);
      setMessage("Login-Methode wurde aktualisiert.");
    } else {
      setError(payload.error ?? "Speichern fehlgeschlagen.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Systemadmin</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-950">Systemeinstellungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Globale Login-Regeln und sichtbare Texte der App verwalten.
        </p>
      </div>

      {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-950">Erlaubte Login-Methoden</h2>
            <p className="text-sm text-gray-500">Diese Einstellung gilt systemweit für alle Benutzer.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.keys(policyLabels) as LoginPolicy[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => savePolicy(item)}
              disabled={saving !== null}
              className={`min-h-12 rounded-lg border px-4 text-sm font-medium transition-colors ${
                policy === item
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {policyLabels[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-950">Loginseite & Branding</h2>
            <p className="text-sm text-gray-500">App-Name, Slogan und Texte der Loginseite anpassen.</p>
          </div>
          <button
            type="button"
            onClick={saveBranding}
            disabled={saving !== null}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            <Save className="h-4 w-4" />
            {saving === "branding" ? "Speichern..." : "Speichern"}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="App-Name">
            <input className={inputClass} value={branding.appName} onChange={(e) => setBranding({ ...branding, appName: e.target.value })} />
          </Field>
          <Field label="Untertitel mobil">
            <input className={inputClass} value={branding.loginSubtitle} onChange={(e) => setBranding({ ...branding, loginSubtitle: e.target.value })} />
          </Field>
          <Field label="Headline">
            <input className={inputClass} value={branding.loginHeadline} onChange={(e) => setBranding({ ...branding, loginHeadline: e.target.value })} />
          </Field>
          <Field label="Highlight">
            <input className={inputClass} value={branding.loginHighlight} onChange={(e) => setBranding({ ...branding, loginHighlight: e.target.value })} />
          </Field>
          <Field label="Beschreibung">
            <textarea className={`${inputClass} min-h-24 resize-y`} value={branding.loginDescription} onChange={(e) => setBranding({ ...branding, loginDescription: e.target.value })} />
          </Field>
          <Field label="Footer">
            <textarea className={`${inputClass} min-h-24 resize-y`} value={branding.loginFooter} onChange={(e) => setBranding({ ...branding, loginFooter: e.target.value })} />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
