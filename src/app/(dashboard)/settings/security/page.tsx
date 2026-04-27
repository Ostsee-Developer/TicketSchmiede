"use client";

import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldOff, Copy, CheckCheck, AlertTriangle } from "lucide-react";
import Image from "next/image";

interface SetupData {
  secret: string;
  qrDataUrl: string;
  backupCodes: string[];
  alreadyEnabled: boolean;
}

type Step = "overview" | "setup" | "backup" | "done" | "disable";

export default function SecuritySettingsPage() {
  const [step, setStep] = useState<Step>("overview");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa/setup")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSetupData(d.data);
          setTwoFaEnabled(d.data.alreadyEnabled);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const startSetup = async () => {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/2fa/setup").then((r) => r.json());
    if (res.success) {
      setSetupData(res.data);
      setStep("setup");
    }
    setLoading(false);
  };

  const confirmToken = async () => {
    if (!setupData || token.length !== 6) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: setupData.secret,
        token,
        backupCodes: setupData.backupCodes,
      }),
    }).then((r) => r.json());

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
    }).then((r) => r.json());

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sicherheitseinstellungen</h1>
        <p className="text-gray-500 mt-1">Verwalte deine Kontosicherheit und Zwei-Faktor-Authentifizierung.</p>
      </div>

      {/* Overview */}
      {step === "overview" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${twoFaEnabled ? "bg-green-100" : "bg-gray-100"}`}>
              {twoFaEnabled
                ? <ShieldCheck className="w-6 h-6 text-green-600" />
                : <ShieldOff className="w-6 h-6 text-gray-400" />}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Zwei-Faktor-Authentifizierung (2FA)</h2>
              <p className="text-sm text-gray-500 mt-1">
                {twoFaEnabled
                  ? "2FA ist aktiviert. Dein Konto ist zusätzlich geschützt."
                  : "2FA ist deaktiviert. Aktiviere es für mehr Sicherheit."}
              </p>
              <div className="flex gap-3 mt-4">
                {twoFaEnabled ? (
                  <button
                    onClick={() => { setStep("disable"); setError(null); setToken(""); setPassword(""); }}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    2FA deaktivieren
                  </button>
                ) : (
                  <button
                    onClick={startSetup}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    2FA einrichten
                  </button>
                )}
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${twoFaEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {twoFaEnabled ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
        </div>
      )}

      {/* Step 1: Show QR code */}
      {step === "setup" && setupData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Schritt 1: QR-Code scannen</h2>
          </div>
          <p className="text-sm text-gray-600">
            Scanne den QR-Code mit deiner Authenticator-App (z. B. Google Authenticator, Authy oder 1Password).
          </p>
          <div className="flex justify-center">
            <div className="p-3 border border-gray-200 rounded-xl bg-white">
              <Image src={setupData.qrDataUrl} alt="2FA QR Code" width={180} height={180} />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1 font-medium">Manueller Code (falls QR nicht lesbar):</p>
            <code className="text-sm font-mono text-gray-800 break-all">{setupData.secret}</code>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Bestätigungscode (6 Ziffern)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("overview")} className="text-sm text-gray-500 hover:text-gray-700">
              Abbrechen
            </button>
            <button
              onClick={confirmToken}
              disabled={token.length !== 6 || submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {submitting ? "Prüfen…" : "Bestätigen"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Backup codes */}
      {step === "backup" && setupData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCheck className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Schritt 2: Backup-Codes sichern</h2>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Speichere diese Codes sicher. Jeder Code kann nur <strong>einmal</strong> verwendet werden,
              falls du keinen Zugriff auf deine Authenticator-App hast.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {setupData.backupCodes.map((code) => (
              <code key={code} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center text-gray-800">
                {code}
              </code>
            ))}
          </div>

          <button
            onClick={copyBackupCodes}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? "Kopiert!" : "Alle Codes kopieren"}
          </button>

          <button
            onClick={() => { setTwoFaEnabled(true); setStep("done"); }}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Codes gespeichert — Abschließen
          </button>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto">
            <ShieldCheck className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">2FA erfolgreich aktiviert!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Dein Konto ist jetzt mit Zwei-Faktor-Authentifizierung geschützt.
            </p>
          </div>
          <button
            onClick={() => setStep("overview")}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Zur Übersicht
          </button>
        </div>
      )}

      {/* Disable 2FA */}
      {step === "disable" && (
        <div className="bg-white rounded-xl border border-red-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <ShieldOff className="w-6 h-6 text-red-500" />
            <h2 className="font-semibold text-gray-900">2FA deaktivieren</h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              Das Deaktivieren von 2FA macht dein Konto weniger sicher. Bitte bestätige mit deinem Passwort und einem Authentifizierungscode.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Aktuelles Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Authenticator-Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("overview")} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Abbrechen
            </button>
            <button
              onClick={disable2FA}
              disabled={!password || token.length !== 6 || submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {submitting ? "Deaktivieren…" : "2FA deaktivieren"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
