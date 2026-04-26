"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

const schema = z.object({
  title: z.string().min(3, "Mindestens 3 Zeichen").max(200),
  description: z.string().min(10, "Mindestens 10 Zeichen"),
  category: z.enum(["HARDWARE", "SOFTWARE", "EMAIL", "NETWORK", "USER_ACCOUNT", "PRINTER", "PHONE", "VPN", "OTHER"]).default("OTHER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  employeeId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Employee { id: string; firstName: string; lastName: string; }

const CATEGORY_LABELS: Record<string, string> = {
  HARDWARE: "Hardware", SOFTWARE: "Software", EMAIL: "E-Mail",
  NETWORK: "Netzwerk", USER_ACCOUNT: "Benutzerkonto", PRINTER: "Drucker",
  PHONE: "Telefon", VPN: "VPN", OTHER: "Sonstiges",
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Niedrig", MEDIUM: "Mittel", HIGH: "Hoch", CRITICAL: "Kritisch",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-gray-600", MEDIUM: "text-blue-600", HIGH: "text-orange-600", CRITICAL: "text-red-600",
};

export default function NewTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    fetch(`/api/employees?tenantId=${id}&status=ACTIVE&limit=200`)
      .then((r) => r.json())
      .then((d) => setEmployees(d.data ?? []))
      .catch(() => {});
  }, [id]);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "OTHER", priority: "MEDIUM" },
  });

  const priority = watch("priority");

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        tenantId: id,
        employeeId: data.employeeId || null,
      }),
    });
    if (res.ok) {
      const ticket = await res.json();
      router.push(`/tenants/${id}/tickets/${ticket.id}`);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tenants/${id}/tickets`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neues Ticket</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Betreff <span className="text-red-500">*</span></label>
              <input {...register("title")} type="text" placeholder="Kurze Beschreibung des Problems" className={inp} />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <select {...register("category")} className={inp}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
              <select {...register("priority")} className={inp + " " + PRIORITY_COLORS[priority]}>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Betroffener Mitarbeiter</label>
              <select {...register("employeeId")} className={inp}>
                <option value="">— Kein Mitarbeiter —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung <span className="text-red-500">*</span></label>
              <textarea {...register("description")} rows={6} placeholder="Detaillierte Beschreibung des Problems, Schritte zur Reproduktion, Fehlermeldungen..." className={inp + " resize-none"} />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/tenants/${id}/tickets`} className={btnSecondary}>Abbrechen</Link>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? "Erstellen..." : "Ticket erstellen"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
const btnPrimary = "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors";
const btnSecondary = "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors";
