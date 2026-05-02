"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, Server, Shield, Users } from "lucide-react";
import { decodeRequestOptions, encodeAuthenticationCredential } from "@/lib/browser-webauthn";

type LoginPolicy = "PASSWORD_AND_PASSKEY" | "PASSWORD_ONLY" | "PASSKEY_ONLY";

const loginSchema = z.object({
  email: z.string().email("Bitte gib eine gültige E-Mail ein"),
  password: z.string().optional(),
  totp: z.string().regex(/^\d{6}$/, "Code muss 6 Ziffern sein").optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10">
        <Icon className="w-4 h-4 text-blue-300" />
      </div>
      <span className="text-sm text-blue-100/80">{text}</span>
    </div>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [policy, setPolicy] = useState<LoginPolicy>("PASSWORD_AND_PASSKEY");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTotp, setRequiresTotp] = useState(false);

  const passwordAllowed = policy !== "PASSKEY_ONLY";
  const passkeyAllowed = policy !== "PASSWORD_ONLY";

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    fetch("/api/auth/passkey/policy")
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.data?.policy) setPolicy(payload.data.policy);
      })
      .catch(() => undefined);
  }, []);

  const onSubmit = async (data: LoginForm) => {
    if (loading || !passwordAllowed) return;
    if (!data.password) {
      setError("Bitte gib dein Passwort ein.");
      return;
    }

    setLoading(true);
    setError(null);

    if (!requiresTotp) {
      try {
        const check = await fetch("/api/auth/check-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.email, password: data.password }),
        }).then((response) => response.json());

        if (check?.requiresTotp) {
          setLoading(false);
          setRequiresTotp(true);
          return;
        }
        if (check?.error) {
          setError("E-Mail oder Passwort falsch. Bitte überprüfe deine Eingaben.");
          setLoading(false);
          return;
        }
      } catch (_error) {
        setError("Verbindungsfehler. Bitte versuche es später erneut.");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      mode: "password",
      email: data.email,
      password: data.password,
      totp: data.totp ?? "",
      redirect: false,
    });

    if (result?.error) {
      setError("E-Mail, Passwort oder Zwei-Faktor-Code ist ungültig.");
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  const signInWithPasskey = async () => {
    if (passkeyLoading || !passkeyAllowed) return;
    const email = getValues("email");
    if (!email) {
      setError("Bitte gib zuerst deine E-Mail-Adresse ein.");
      return;
    }
    if (!window.PublicKeyCredential) {
      setError("Dieser Browser unterstützt Passkeys nicht.");
      return;
    }

    setPasskeyLoading(true);
    setError(null);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/authentication-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then((response) => response.json());

      if (!optionsResponse.success) {
        setError(optionsResponse.error ?? "Für diesen Benutzer ist kein Passkey eingerichtet.");
        setPasskeyLoading(false);
        return;
      }

      const credential = await navigator.credentials.get({
        publicKey: decodeRequestOptions(optionsResponse.data.options),
      });

      if (!credential) {
        setError("Passkey-Anmeldung wurde abgebrochen.");
        setPasskeyLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        mode: "passkey",
        email,
        assertion: JSON.stringify(encodeAuthenticationCredential(credential as PublicKeyCredential)),
        redirect: false,
      });

      if (result?.error) {
        setError("Passkey-Anmeldung fehlgeschlagen.");
        setPasskeyLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (_error) {
      setError("Passkey-Anmeldung fehlgeschlagen oder abgebrochen.");
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="lg:hidden text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Ticket Schmiede</h1>
        <p className="text-gray-500 text-sm mt-1">IT-Dokumentation & Ticketsystem</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="mb-7">
          <h2 className="text-xl font-bold text-gray-900">
            {requiresTotp ? "Zwei-Faktor-Authentifizierung" : "Anmelden"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {requiresTotp
              ? "Bitte gib den Code aus deiner Authenticator-App ein."
              : "Willkommen zurück. Bitte melde dich an."}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!requiresTotp ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-Mail-Adresse</label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                  placeholder="name@firma.de"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              {passwordAllowed && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Passwort</label>
                  <div className="relative">
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Authenticator-Code</label>
              <input
                {...register("totp")}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-center tracking-widest font-mono transition"
                placeholder="000000"
              />
              <p className="mt-2 text-xs text-gray-500 text-center">
                Angemeldet als: <span className="font-medium">{getValues("email")}</span>{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    setRequiresTotp(false);
                    setError(null);
                  }}
                >
                  Zurück
                </button>
              </p>
            </div>
          )}

          {passwordAllowed && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (requiresTotp ? "Prüfen..." : "Anmelden...") : requiresTotp ? "Code bestätigen" : "Anmelden"}
            </button>
          )}
        </form>

        {passkeyAllowed && !requiresTotp && (
          <button
            type="button"
            onClick={signInWithPasskey}
            disabled={passkeyLoading}
            className="mt-3 w-full border border-gray-300 hover:bg-gray-50 disabled:bg-gray-50 text-gray-800 font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {passkeyLoading ? "Passkey prüfen..." : "Mit Passkey anmelden"}
          </button>
        )}
      </div>

      <p className="text-center text-gray-400 text-xs mt-6">
        © {new Date().getFullYear()} Ticket Schmiede - Sicher & mandantenfähig
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-10 relative overflow-hidden">
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-blue-600 rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Ticket Schmiede</p>
            <p className="text-blue-300/70 text-xs">IT-Management Platform</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              IT-Dokumentation<br />
              <span className="text-blue-400">neu gedacht.</span>
            </h1>
            <p className="text-blue-200/70 mt-4 text-base leading-relaxed max-w-sm">
              Mandantenfähig, sicher und einfach zu bedienen. Verwalte Tickets, Geräte und Zugangsdaten an einem Ort.
            </p>
          </div>

          <div className="space-y-3">
            <FeatureItem icon={Lock} text="AES-256 verschlüsselte Zugangsdaten" />
            <FeatureItem icon={Server} text="Vollständige Asset-Verwaltung" />
            <FeatureItem icon={Users} text="Mandantenfähiges RBAC-System" />
            <FeatureItem icon={CheckCircle2} text="Lückenloser Audit-Trail" />
          </div>
        </div>

        <p className="relative text-blue-400/50 text-xs">IT Service - Sven Weigle · Alle Rechte vorbehalten</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <Suspense
          fallback={
            <div className="w-full max-w-sm bg-white rounded-2xl p-8 text-center text-gray-400 shadow-xl border border-gray-100">
              Lädt...
            </div>
          }
        >
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  );
}
