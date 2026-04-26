"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Pflichtfeld").max(100),
  room: z.string().optional(),
  networkOutlet: z.string().optional(),
  ipAddress: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewWorkstationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await fetch("/api/workstations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, tenantId: id }),
    });
    if (res.ok) {
      router.push(`/tenants/${id}/workstations`);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/workstations`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neuer Arbeitsplatz</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung <span className="text-red-500">*</span></label>
              <input {...register("name")} type="text" placeholder="z.B. Arbeitsplatz-01, Empfang" className={inp} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raum</label>
              <input {...register("room")} type="text" placeholder="Raum 101" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Netzwerkdose</label>
              <input {...register("networkOutlet")} type="text" placeholder="D1-12" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP-Adresse</label>
              <input {...register("ipAddress")} type="text" placeholder="192.168.1.100" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea {...register("notes")} rows={3} className={inp + " resize-none"} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/tenants/${id}/workstations`} className={btnSecondary}>Abbrechen</Link>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? "Speichern..." : "Arbeitsplatz anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
const btnPrimary = "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors";
const btnSecondary = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors";
