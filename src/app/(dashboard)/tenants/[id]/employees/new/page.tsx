"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

const schema = z.object({
  firstName: z.string().min(1, "Pflichtfeld").max(100),
  lastName: z.string().min(1, "Pflichtfeld").max(100),
  email: z.string().email("Ungültige E-Mail").or(z.literal("")).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(["ACTIVE", "DISABLED", "LEFT"]).default("ACTIVE"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "ACTIVE" },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, tenantId: id, email: data.email || null }),
    });
    if (res.ok) {
      router.push(`/tenants/${id}/employees`);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/employees`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neuer Mitarbeiter</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Stammdaten</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vorname <span className="text-red-500">*</span></label>
              <input {...register("firstName")} type="text" placeholder="Max" className={inp} />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nachname <span className="text-red-500">*</span></label>
              <input {...register("lastName")} type="text" placeholder="Mustermann" className={inp} />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input {...register("email")} type="email" placeholder="max@firma.de" className={inp} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input {...register("phone")} type="tel" placeholder="+49 123 456" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobil</label>
              <input {...register("mobile")} type="tel" placeholder="+49 175 123456" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...register("status")} className={inp}>
                <option value="ACTIVE">Aktiv</option>
                <option value="DISABLED">Deaktiviert</option>
                <option value="LEFT">Ausgeschieden</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input {...register("position")} type="text" placeholder="IT-Administrator" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abteilung</label>
              <input {...register("department")} type="text" placeholder="IT" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
              <textarea {...register("notes")} rows={3} className={inp + " resize-none"} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/tenants/${id}/employees`} className={btnSecondary}>Abbrechen</Link>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? "Speichern..." : "Mitarbeiter anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
const btnPrimary = "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors";
const btnSecondary = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors";
