"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Pflichtfeld").max(200),
  username: z.string().optional(),
  password: z.string().optional(),
  url: z.string().url("Ungültige URL").or(z.literal("")).optional(),
  category: z.string().optional(),
  employeeId: z.string().optional(),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Template { id: string; name: string; category: string | null; usernameHint: string | null; urlHint: string | null; }
interface Employee { id: string; firstName: string; lastName: string; }

export default function NewCredentialPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/credential-templates").then((r) => r.json()).then((d) => setTemplates(d.data ?? d ?? [])).catch(() => {});
    fetch(`/api/employees?tenantId=${id}&limit=200`).then((r) => r.json()).then((d) => setEmployees(d.data ?? [])).catch(() => {});
  }, [id]);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const applyTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setValue("name", tpl.name);
    setValue("category", tpl.category ?? "");
    if (tpl.usernameHint) setValue("username", tpl.usernameHint);
    if (tpl.urlHint) setValue("url", tpl.urlHint);
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const payload = {
      ...data,
      tenantId: id,
      employeeId: data.employeeId || null,
      url: data.url || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
    };
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push(`/tenants/${id}/credentials`);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/credentials`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neuer Zugangsdatensatz</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

        {templates.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-blue-800 mb-2">Vorlage auswählen (optional)</label>
            <select onChange={(e) => applyTemplate(e.target.value)} className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Keine Vorlage —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ""}</option>)}
            </select>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung <span className="text-red-500">*</span></label>
              <input {...register("name")} type="text" placeholder="Microsoft 365 – Max Mustermann" className={inp} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
              <input {...register("username")} type="text" placeholder="max.mustermann@firma.de" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <div className="relative">
                <input {...register("password")} type={showPassword ? "text" : "password"} className={inp + " pr-10"} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                  {showPassword ? "Verbergen" : "Zeigen"}
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input {...register("url")} type="url" placeholder="https://portal.office.com" className={inp} />
              {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <input {...register("category")} type="text" placeholder="Microsoft 365, VPN..." className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter zuweisen</label>
              <select {...register("employeeId")} className={inp}>
                <option value="">— Kein Mitarbeiter —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ablaufdatum</label>
              <input {...register("expiresAt")} type="date" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea {...register("notes")} rows={3} className={inp + " resize-none"} placeholder="Sicherheitshinweise, Anmerkungen..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/tenants/${id}/credentials`} className={btnSecondary}>Abbrechen</Link>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? "Speichern..." : "Zugangsdaten anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
const btnPrimary = "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors";
const btnSecondary = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors";
