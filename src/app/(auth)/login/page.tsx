"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, Lock, Server, Users, CheckCircle2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Bitte gib eine gültige E-Mail ein"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTotp, setRequiresTotp] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    if (loading) return; // Prevent double-click
    setLoading(true);
    setError(null);

    // If TOTP step not yet shown, check if it's required
    if (!requiresTotp) {
      try {
        const check = await fetch("/api/auth/check-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.email, password: data.password }),
        }).then((r) => r.json());

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
      } catch (err) {
        setError("Verbindungsfehler. Bitte versuche es später erneut.");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      totp: data.totp ?? "",
      redirect: false,
    });

    if (result?.error) {
      setError(
        result.error.includes("TOTP") || result.error.includes("2FA")
          ? "Der Zwei-Faktor-Code ist ungültig oder abgelaufen."
          : "E-Mail oder Passwort falsch. Bitte überprüfe deine Eingaben."
      );
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Mobile branding */}
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
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!requiresTotp ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  E-Mail-Adresse
                </label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                  placeholder="name@firma.de"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Passwort
                </label>
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
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Authenticator-Code
              </label>
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
                Angemeldet als: <span className="font-medium">{getValues("email")}</span> ·{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => { setRequiresTotp(false); setError(null); }}
                >
                  Zurück
                </button>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {requiresTotp ? "Prüfen…" : "Anmelden…"}
              </>
            ) : requiresTotp ? (
              "Code bestätigen"
            ) : (
              "Anmelden"
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-gray-400 text-xs mt-6">
        © {new Date().getFullYear()} Ticket Schmiede — Sicher & Mandantenfähig
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left: Branding Panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-blue-600 rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Ticket Schmiede</p>
            <p className="text-blue-300/70 text-xs">IT-Management Platform</p>
          </div>
        </div>

        {/* Main claim */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              IT-Dokumentation<br />
              <span className="text-blue-400">neu gedacht.</span>
            </h1>
            <p className="text-blue-200/70 mt-4 text-base leading-relaxed max-w-sm">
              Mandantenfähig, sicher und einfach zu bedienen.
              Verwalte Tickets, Geräte und Zugangsdaten an einem Ort.
            </p>
          </div>

          <div className="space-y-3">
            <FeatureItem icon={Lock} text="AES-256 verschlüsselte Zugangsdaten" />
            <FeatureItem icon={Server} text="Vollständige Asset-Verwaltung" />
            <FeatureItem icon={Users} text="Mandantenfähiges RBAC-System" />
            <FeatureItem icon={CheckCircle2} text="Lückenloser Audit-Trail" />
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-blue-400/50 text-xs">
            IT Service - Sven Weigle · Alle Rechte vorbehalten 
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <Suspense
          fallback={
            <div className="w-full max-w-sm bg-white rounded-2xl p-8 text-center text-gray-400 shadow-xl border border-gray-100">
              Lädt…
            </div>
          }
        >
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  );
}
