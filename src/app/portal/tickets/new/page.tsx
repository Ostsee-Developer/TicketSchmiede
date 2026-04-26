"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

const schema = z.object({
  title: z.string().min(5, "Bitte gib einen aussagekräftigen Titel ein (min. 5 Zeichen)"),
  description: z.string().min(20, "Bitte beschreibe das Problem ausführlich (min. 20 Zeichen)"),
  category: z.string().min(1, "Bitte wähle eine Kategorie"),
  priority: z.string().default("MEDIUM"),
  employeeId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const categories = [
  { value: "HARDWARE", label: "Hardware (PC, Drucker, Monitor, ...)" },
  { value: "SOFTWARE", label: "Software / Programm" },
  { value: "EMAIL", label: "E-Mail / Outlook" },
  { value: "NETWORK", label: "Netzwerk / Internet" },
  { value: "USER_ACCOUNT", label: "Benutzerkonto / Passwort" },
  { value: "PRINTER", label: "Drucker / Scanner" },
  { value: "PHONE", label: "Telefon" },
  { value: "VPN", label: "VPN / Fernzugang" },
  { value: "OTHER", label: "Sonstiges" },
];

export default function NewPortalTicketPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM" },
  });

  useEffect(() => {
    // Get user's tenant and employees
    fetch("/api/tenants").then((r) => r.json()).then((d) => {
      const tenants = d.data?.data;
      if (tenants?.length > 0) {
        const tid = tenants[0].id;
        setTenantId(tid);
        fetch(`/api/employees?tenantId=${tid}&status=ACTIVE`)
          .then((r) => r.json())
          .then((ed) => setEmployees(ed.data?.data ?? []));
      }
    });
  }, []);

  const onSubmit = async (data: FormData) => {
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tenantId }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Ein Fehler ist aufgetreten");
        return;
      }

      router.push("/portal/tickets");
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Neues Support-Ticket</h1>
        <p className="text-gray-500 mt-1">
          Beschreibe dein Problem möglichst genau, damit wir dir schnell helfen können.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Betroffener Mitarbeiter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Betroffener Mitarbeiter <span className="text-gray-400">(optional)</span>
          </label>
          <select
            {...register("employeeId")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Kein bestimmter Mitarbeiter</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName}, {e.firstName}
              </option>
            ))}
          </select>
        </div>

        {/* Kategorie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategorie <span className="text-red-500">*</span>
          </label>
          <select
            {...register("category")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Bitte wählen...</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
        </div>

        {/* Priorität */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dringlichkeit</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: "LOW", label: "Niedrig", color: "border-gray-300 text-gray-600" },
              { value: "MEDIUM", label: "Normal", color: "border-blue-300 text-blue-700" },
              { value: "HIGH", label: "Hoch", color: "border-orange-300 text-orange-700" },
              { value: "CRITICAL", label: "Kritisch", color: "border-red-300 text-red-700" },
            ].map((p) => (
              <label key={p.value} className="cursor-pointer">
                <input {...register("priority")} type="radio" value={p.value} className="sr-only" />
                <div className={`text-center border-2 rounded-lg py-2 px-3 text-sm font-medium transition-colors hover:bg-gray-50 ${p.color}`}>
                  {p.label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Titel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titel / Kurzbezeichnung <span className="text-red-500">*</span>
          </label>
          <input
            {...register("title")}
            type="text"
            placeholder="z.B. Drucker druckt nicht, Outlook öffnet sich nicht, ..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Problembeschreibung <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register("description")}
            rows={6}
            placeholder="Beschreibe das Problem möglichst genau:&#10;- Was passiert genau?&#10;- Wann ist das Problem aufgetreten?&#10;- Gibt es eine Fehlermeldung?&#10;- Was hast du bereits versucht?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "Ticket wird erstellt..." : "Ticket absenden"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
