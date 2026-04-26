"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Pflichtfeld").max(200),
  vendor: z.string().optional(),
  version: z.string().optional(),
  licenseType: z.enum(["PERPETUAL", "SUBSCRIPTION", "VOLUME", "OEM", "FREEWARE", "OPEN_SOURCE", "TRIAL"]).default("PERPETUAL"),
  licenseKey: z.string().optional(),
  licenseCount: z.coerce.number().int().min(1).optional().or(z.literal("")),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  costCenter: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional().or(z.literal("")),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const LICENSE_LABELS: Record<string, string> = {
  PERPETUAL: "Dauerlizenz", SUBSCRIPTION: "Abo", VOLUME: "Volumenlizenz",
  OEM: "OEM", FREEWARE: "Freeware", OPEN_SOURCE: "Open Source", TRIAL: "Test",
};

export default function NewSoftwarePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { licenseType: "PERPETUAL" },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const payload = {
      ...data,
      tenantId: id,
      licenseCount: data.licenseCount === "" ? null : data.licenseCount || null,
      purchasePrice: data.purchasePrice === "" ? null : data.purchasePrice || null,
      validFrom: data.validFrom ? new Date(data.validFrom).toISOString() : null,
      validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : null,
      licenseKey: data.licenseKey || null,
    };
    const res = await fetch("/api/software", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push(`/tenants/${id}/software`);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/software`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neue Software</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Softwarename <span className="text-red-500">*</span></label>
              <input {...register("name")} type="text" placeholder="Microsoft 365, AutoCAD..." className={inp} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller / Vendor</label>
              <input {...register("vendor")} type="text" placeholder="Microsoft, Autodesk..." className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input {...register("version")} type="text" placeholder="2024, v3.5..." className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lizenztyp</label>
              <select {...register("licenseType")} className={inp}>
                {Object.entries(LICENSE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Lizenzen</label>
              <input {...register("licenseCount")} type="number" min={1} placeholder="1" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Lizenzschlüssel</label>
              <input {...register("licenseKey")} type="text" placeholder="XXXXX-XXXXX-XXXXX" className={inp + " font-mono"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gültig ab</label>
              <input {...register("validFrom")} type="date" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis / Ablauf</label>
              <input {...register("validUntil")} type="date" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kostenstelle</label>
              <input {...register("costCenter")} type="text" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kaufpreis (€)</label>
              <input {...register("purchasePrice")} type="number" step="0.01" min={0} placeholder="0.00" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea {...register("notes")} rows={3} className={inp + " resize-none"} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/tenants/${id}/software`} className={btnSecondary}>Abbrechen</Link>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? "Speichern..." : "Software anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
const btnPrimary = "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors";
const btnSecondary = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors";
