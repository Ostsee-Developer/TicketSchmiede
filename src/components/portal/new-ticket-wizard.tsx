"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  tenantId: string;
  employees: Employee[];
}

const schema = z.object({
  employeeId: z.string().optional(),
  category: z.string().min(1, "Bitte wähle eine Kategorie"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(5, "Mindestens 5 Zeichen"),
  description: z.string().min(20, "Mindestens 20 Zeichen – beschreibe das Problem genau"),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  { value: "HARDWARE",     label: "Hardware",          icon: "🖥️",  desc: "PC, Monitor, Tastatur, Maus, …" },
  { value: "SOFTWARE",     label: "Software",          icon: "💾",  desc: "Programme, Apps, Updates, …" },
  { value: "EMAIL",        label: "E-Mail",            icon: "📧",  desc: "Outlook, Postfach, Anhänge, …" },
  { value: "NETWORK",      label: "Netzwerk",          icon: "🌐",  desc: "Internet, WLAN, Verbindung, …" },
  { value: "USER_ACCOUNT", label: "Benutzerkonto",     icon: "🔑",  desc: "Passwort, Anmeldung, Rechte, …" },
  { value: "PRINTER",      label: "Drucker / Scanner", icon: "🖨️",  desc: "Drucken, scannen, Fehler, …" },
  { value: "PHONE",        label: "Telefon",           icon: "📞",  desc: "Festnetz, Mobil, Voicemail, …" },
  { value: "VPN",          label: "VPN / Fernzugang",  icon: "🔒",  desc: "Homeoffice, Remote Desktop, …" },
  { value: "OTHER",        label: "Sonstiges",         icon: "💬",  desc: "Anderes Problem, nicht aufgelistet" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW",      label: "Niedrig",  desc: "Kein Zeitdruck",              color: "border-gray-300 text-gray-700", active: "border-gray-500 bg-gray-50 text-gray-900" },
  { value: "MEDIUM",   label: "Normal",   desc: "Sobald möglich",              color: "border-blue-300 text-blue-700", active: "border-blue-600 bg-blue-50 text-blue-900" },
  { value: "HIGH",     label: "Hoch",     desc: "Beeinträchtigt die Arbeit",   color: "border-orange-300 text-orange-700", active: "border-orange-500 bg-orange-50 text-orange-900" },
  { value: "CRITICAL", label: "Kritisch", desc: "Arbeit nicht möglich",        color: "border-red-300 text-red-700", active: "border-red-600 bg-red-50 text-red-900" },
];

const STEPS = [
  { id: 1, label: "Kategorie" },
  { id: 2, label: "Details" },
  { id: 3, label: "Beschreibung" },
];

export function NewTicketWizard({ tenantId, employees }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM" },
  });

  const selectedCategory = watch("category");
  const selectedPriority = watch("priority");

  const goNext = async () => {
    let valid = false;
    if (step === 1) valid = await trigger("category");
    if (step === 2) valid = await trigger(["priority", "title", "employeeId"]);
    if (step === 3) valid = await trigger("description");
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setApiError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tenantId }),
      });
      const result = await res.json();
      if (!res.ok) {
        setApiError(result.error ?? "Ein Fehler ist aufgetreten");
        return;
      }
      router.push(`/portal/tickets/${result.data?.id ?? ""}`);
    } catch {
      setApiError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <button
        onClick={() => step > 1 ? setStep((s) => s - 1) : router.push("/portal/tickets")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {step > 1 ? "Zurück" : "Abbrechen"}
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                s.id < step
                  ? "bg-blue-600 border-blue-600 text-white"
                  : s.id === step
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-gray-300 text-gray-400 bg-white"
              }`}>
                {s.id < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.id}
              </div>
              <span className={`text-xs mt-1 font-medium ${s.id === step ? "text-blue-600" : "text-gray-400"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${step > s.id ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ── Step 1: Kategorie ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Was ist das Problem?</h2>
              <p className="text-sm text-gray-500 mt-0.5">Wähle die passende Kategorie</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setValue("category", cat.value, { shouldValidate: true })}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all hover:shadow-sm ${
                    selectedCategory === cat.value
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl leading-none mt-0.5">{cat.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${selectedCategory === cat.value ? "text-blue-900" : "text-gray-800"}`}>
                      {cat.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{cat.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-sm text-red-600">{errors.category.message}</p>
            )}

            <div className="pt-2">
              <button type="button" onClick={goNext}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors">
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Details zum Problem</h2>
              <p className="text-sm text-gray-500 mt-0.5">Kurze Beschreibung und Dringlichkeit</p>
            </div>

            {/* Employee */}
            {employees.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Betroffener Mitarbeiter <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  {...register("employeeId")}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Kein bestimmter Mitarbeiter</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.lastName}, {e.firstName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Kurztitel <span className="text-red-500">*</span>
              </label>
              <input
                {...register("title")}
                type="text"
                placeholder="z.B. Drucker druckt nicht, Outlook öffnet sich nicht…"
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Dringlichkeit</label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setValue("priority", p.value as FormData["priority"], { shouldValidate: true })}
                    className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                      selectedPriority === p.value ? p.active : `${p.color} bg-white hover:bg-gray-50`
                    }`}
                  >
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="text-xs opacity-70 mt-0.5">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <button type="button" onClick={goNext}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors">
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Beschreibung ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Problembeschreibung</h2>
              <p className="text-sm text-gray-500 mt-0.5">Je mehr Details, desto schneller können wir helfen</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Beschreibung <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register("description")}
                rows={8}
                placeholder={`Was passiert genau?\nWann ist das Problem aufgetreten?\nGibt es eine Fehlermeldung?\nWas hast du bereits versucht?`}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
            </div>

            {/* File upload */}
            <FileUploadArea files={files} onChange={setFiles} />

            {/* Summary card */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm">
              <p className="font-medium text-gray-700 mb-2">Zusammenfassung</p>
              <dl className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">Kategorie</dt>
                  <dd className="text-gray-800 font-medium">
                    {CATEGORIES.find((c) => c.value === selectedCategory)?.label ?? selectedCategory}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">Dringlichkeit</dt>
                  <dd className="text-gray-800 font-medium">
                    {PRIORITY_OPTIONS.find((p) => p.value === selectedPriority)?.label ?? selectedPriority}
                  </dd>
                </div>
              </dl>
            </div>

            {apiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Ticket wird erstellt…
                </>
              ) : (
                "Ticket absenden"
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function FileUploadArea({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    onChange([...files, ...dropped].slice(0, 5));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    onChange([...files, ...picked].slice(0, 5));
  };

  const remove = (index: number) => onChange(files.filter((_, i) => i !== index));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Dateien <span className="text-gray-400 font-normal">(optional, max. 5)</span>
      </label>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors cursor-pointer"
        onClick={() => document.getElementById("portal-file-input")?.click()}
      >
        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-500">
          Dateien hier ablegen oder <span className="text-blue-600">auswählen</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Screenshots, Fehlermeldungen, Dokumente</p>
        <input
          id="portal-file-input"
          type="file"
          multiple
          className="hidden"
          onChange={handleInput}
          accept="image/*,.pdf,.doc,.docx,.txt,.log"
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
