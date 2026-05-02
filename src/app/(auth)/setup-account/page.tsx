"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LockKeyhole, Shield } from "lucide-react";

type LoginPolicy = "PASSWORD_AND_PASSKEY" | "PASSWORD_ONLY" | "PASSKEY_ONLY";

function SetupAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [policy, setPolicy] = useState<LoginPolicy>("PASSWORD_AND_PASSKEY");
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Einladungslink fehlt.");
      setLoading(false);
      return;
    }
    fetch(`/api/account/setup?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          setUser(payload.data.user);
          setPolicy(payload.data.policy);
        } else {
          setError(payload.error ?? "Einladungslink ist ungültig.");
        }
      })
      .catch(() => setError("Einladungslink konnte nicht geprüft werden."))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (policy !== "PASSKEY_ONLY" && password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    const response = await fetch("/api/account/setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.success) setDone(true);
    else setError(payload.error ?? "Einrichtung fehlgeschlagen.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Shield className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-950">Konto einrichten</h1>
            <p className="text-sm text-gray-500">Ticket Schmiede</p>
          </div>
        </div>

        {loading ? <p className="text-sm text-gray-500">Einladung wird geprüft...</p> : null}
        {error ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {done ? (
          <div className="space-y-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <div>
              <h2 className="font-semibold text-gray-950">Konto ist vorbereitet</h2>
              <p className="mt-1 text-sm text-gray-500">
                Melde dich jetzt an. Profilbild und Passkey richtest du danach in den Konto-Einstellungen ein.
              </p>
            </div>
            <Link href="/login" className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              Zum Login
            </Link>
          </div>
        ) : user ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-950">{user.name}</p>
              <p className="text-gray-500">{user.email}</p>
            </div>
            {policy === "PASSKEY_ONLY" ? (
              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Das System ist auf Nur-Passkey eingestellt. Schließe diese Einrichtung ab und erstelle den Passkey anschließend über den Login- oder Konto-Fluss.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Passwort</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Passwort bestätigen</span>
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>
              </>
            )}
            <button type="submit" className="min-h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              Einrichtung abschließen
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <Suspense fallback={null}>
      <SetupAccountContent />
    </Suspense>
  );
}
