"use client";

import { type ReactNode, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, User, MapPin, Monitor, Cpu, Code2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createEmployeeFromWizard, type EmployeeWizardData } from "./action";

// ── Types ──────────────────────────────────────────────────────

interface Location { id: string; name: string }
interface Workstation { id: string; name: string; location?: { name: string } | null }
interface Device { id: string; name: string; type: string; serialNumber?: string | null }
interface Software { id: string; name: string; vendor?: string | null }

interface Props {
  tenantId: string;
  tenantName: string;
  locations: Location[];
  workstations: Workstation[];
  availableDevices: Device[];
  availableSoftware: Software[];
}

// ── Step schemas ───────────────────────────────────────────────

const step1Schema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  email: z.string().email("Ungültige E-Mail").or(z.literal("")).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(["ACTIVE", "DISABLED", "LEFT"]),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;

// ── Wizard Steps ───────────────────────────────────────────────

const STEPS = [
  { id: "basics", title: "Basisdaten", description: "Name, Kontakt, Position", icon: User },
  { id: "location", title: "Standort", description: "Standortzuordnung", icon: MapPin },
  { id: "workstation", title: "Arbeitsplatz", description: "Arbeitsplatzzuordnung", icon: Monitor },
  { id: "devices", title: "Geräte", description: "Gerätezuweisung", icon: Cpu },
  { id: "software", title: "Software", description: "Softwarezuordnung", icon: Code2 },
  { id: "summary", title: "Zusammenfassung", description: "Überprüfen & Bestätigen", icon: Check },
];

// ── Step Indicator ─────────────────────────────────────────────

function WizardStepIndicator({ current }: { current: number }) {
  return (
    <div>
      {/* Desktop */}
      <div className="hidden sm:flex items-start gap-0 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all",
                    isDone && "border-primary bg-primary text-primary-foreground",
                    isActive && "border-primary bg-primary/10 text-primary ring-4 ring-primary/20",
                    !isDone && !isActive && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <p
                  className={cn(
                    "text-xs font-medium text-center max-w-[72px] leading-tight",
                    isActive && "text-primary",
                    isDone && "text-foreground",
                    !isDone && !isActive && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mt-[-1.5rem] transition-colors",
                    i < current ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{STEPS[current]?.title}</span>
          <span className="text-xs text-muted-foreground">
            {current + 1} / {STEPS.length}
          </span>
        </div>
        <div className="flex gap-1 h-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn("flex-1 rounded-full transition-all duration-300", i <= current ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{STEPS[current]?.description}</p>
      </div>
    </div>
  );
}

// ── Navigation buttons ─────────────────────────────────────────

function NavButtons({
  onBack,
  onNext,
  nextLabel,
  loading,
  isFirst,
  isLast,
  isSubmit,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  loading?: boolean;
  isFirst: boolean;
  isLast: boolean;
  isSubmit?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 pt-5 mt-2 border-t border-border", isFirst ? "justify-end" : "justify-between")}>
      {!isFirst && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border bg-card hover:bg-accent px-4 py-2.5 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Zurück
        </button>
      )}
      {isSubmit ? (
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {nextLabel ?? "Abschließen"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
        >
          {nextLabel ?? (isLast ? "Abschließen" : "Weiter")}
          {!isLast && <ChevronRight className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

// ── Field Components ───────────────────────────────────────────

function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent";

const selectCls =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent";

// ── Main Wizard ────────────────────────────────────────────────

export function EmployeeWizard({
  tenantId,
  tenantName,
  locations,
  workstations,
  availableDevices,
  availableSoftware,
}: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 data
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues: getStep1Values,
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { status: "ACTIVE" },
  });

  // Steps 2-5 data
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string>("");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<Set<string>>(new Set());

  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const handleStep1Submit = handleSubmit(() => goNext());

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const step1 = getStep1Values();
      const data: EmployeeWizardData = {
        ...step1,
        locationId: selectedLocationId || undefined,
        workstationId: selectedWorkstationId || undefined,
        deviceIds: Array.from(selectedDeviceIds),
        softwareIds: Array.from(selectedSoftwareIds),
      };
      const result = await createEmployeeFromWizard(tenantId, data);
      if (result.ok && result.employeeId) {
        router.push(`/tenants/${tenantId}/employees/${result.employeeId}`);
      } else {
        setError(result.error ?? "Unbekannter Fehler");
        setLoading(false);
      }
    } catch {
      setError("Fehler beim Anlegen");
      setLoading(false);
    }
  };

  const step1 = getStep1Values();
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const selectedWorkstation = workstations.find((w) => w.id === selectedWorkstationId);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Step Indicator */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card">
        <WizardStepIndicator current={currentStep} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{STEPS[currentStep]?.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{STEPS[currentStep]?.description}</p>
        </div>

        <div className="p-5">
          {/* ── Step 0: Basisdaten ── */}
          {currentStep === 0 && (
            <form onSubmit={handleStep1Submit} id="step1form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Vorname" required error={errors.firstName?.message}>
                  <input {...register("firstName")} placeholder="Max" className={inputCls} />
                </Field>
                <Field label="Nachname" required error={errors.lastName?.message}>
                  <input {...register("lastName")} placeholder="Mustermann" className={inputCls} />
                </Field>
                <Field label="E-Mail" error={errors.email?.message}>
                  <input {...register("email")} type="email" placeholder="max@firma.de" className={inputCls} />
                </Field>
                <Field label="Telefon">
                  <input {...register("phone")} type="tel" placeholder="+49 ..." className={inputCls} />
                </Field>
                <Field label="Mobil">
                  <input {...register("mobile")} type="tel" placeholder="+49 ..." className={inputCls} />
                </Field>
                <Field label="Position">
                  <input {...register("position")} placeholder="Senior Developer" className={inputCls} />
                </Field>
                <Field label="Abteilung">
                  <input {...register("department")} placeholder="IT" className={inputCls} />
                </Field>
                <Field label="Status">
                  <select {...register("status")} className={selectCls}>
                    <option value="ACTIVE">Aktiv</option>
                    <option value="DISABLED">Deaktiviert</option>
                    <option value="LEFT">Ausgeschieden</option>
                  </select>
                </Field>
                <Field label="Startdatum">
                  <input {...register("startDate")} type="date" className={inputCls} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Notizen">
                  <textarea
                    {...register("notes")}
                    rows={3}
                    placeholder="Interne Anmerkungen..."
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground resize-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
              </div>
              <NavButtons isFirst={isFirst} isLast={isLast} onBack={goBack} isSubmit nextLabel="Weiter" />
            </form>
          )}

          {/* ── Step 1: Standort ── */}
          {currentStep === 1 && (
            <div>
              {locations.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">Keine Standorte vorhanden</p>
                  <p className="text-xs text-muted-foreground">Dieser Schritt kann übersprungen werden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLocationId("")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      !selectedLocationId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                        !selectedLocationId ? "border-primary bg-primary" : "border-muted-foreground/30",
                      )}
                    >
                      {!selectedLocationId && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-muted-foreground italic">Kein Standort</span>
                  </button>
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSelectedLocationId(loc.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                        selectedLocationId === loc.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                          selectedLocationId === loc.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30",
                        )}
                      >
                        {selectedLocationId === loc.id && (
                          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{loc.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <NavButtons isFirst={isFirst} isLast={isLast} onBack={goBack} onNext={goNext} />
            </div>
          )}

          {/* ── Step 2: Arbeitsplatz ── */}
          {currentStep === 2 && (
            <div>
              {workstations.length === 0 ? (
                <div className="text-center py-8">
                  <Monitor className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">Keine Arbeitsplätze vorhanden</p>
                  <p className="text-xs text-muted-foreground">Dieser Schritt kann übersprungen werden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkstationId("")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      !selectedWorkstationId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        !selectedWorkstationId ? "border-primary bg-primary" : "border-muted-foreground/30",
                      )}
                    >
                      {!selectedWorkstationId && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-muted-foreground italic">Kein Arbeitsplatz</span>
                  </button>
                  {workstations.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => setSelectedWorkstationId(ws.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                        selectedWorkstationId === ws.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                          selectedWorkstationId === ws.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30",
                        )}
                      >
                        {selectedWorkstationId === ws.id && (
                          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ws.name}</p>
                        {ws.location && (
                          <p className="text-xs text-muted-foreground">{ws.location.name}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <NavButtons isFirst={isFirst} isLast={isLast} onBack={goBack} onNext={goNext} />
            </div>
          )}

          {/* ── Step 3: Geräte ── */}
          {currentStep === 3 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Mehrfachauswahl möglich. Nur verfügbare Geräte (aktuell nicht zugewiesen) werden angezeigt.
              </p>
              {availableDevices.length === 0 ? (
                <div className="text-center py-8">
                  <Cpu className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Keine verfügbaren Geräte</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableDevices.map((dev) => {
                    const selected = selectedDeviceIds.has(dev.id);
                    return (
                      <button
                        key={dev.id}
                        type="button"
                        onClick={() => setSelectedDeviceIds(toggleSet(selectedDeviceIds, dev.id))}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                        )}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            selected ? "border-primary bg-primary" : "border-muted-foreground/30",
                          )}
                        >
                          {selected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{dev.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {dev.type}
                            {dev.serialNumber && ` · ${dev.serialNumber}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedDeviceIds.size > 0 && (
                <p className="text-xs text-primary mt-2 font-medium">
                  {selectedDeviceIds.size} Gerät{selectedDeviceIds.size !== 1 ? "e" : ""} ausgewählt
                </p>
              )}
              <NavButtons isFirst={isFirst} isLast={isLast} onBack={goBack} onNext={goNext} />
            </div>
          )}

          {/* ── Step 4: Software ── */}
          {currentStep === 4 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Mehrfachauswahl möglich.</p>
              {availableSoftware.length === 0 ? (
                <div className="text-center py-8">
                  <Code2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Keine Software vorhanden</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableSoftware.map((sw) => {
                    const selected = selectedSoftwareIds.has(sw.id);
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        onClick={() => setSelectedSoftwareIds(toggleSet(selectedSoftwareIds, sw.id))}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                        )}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            selected ? "border-primary bg-primary" : "border-muted-foreground/30",
                          )}
                        >
                          {selected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sw.name}</p>
                          {sw.vendor && <p className="text-xs text-muted-foreground">{sw.vendor}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedSoftwareIds.size > 0 && (
                <p className="text-xs text-primary mt-2 font-medium">
                  {selectedSoftwareIds.size} Software-Paket{selectedSoftwareIds.size !== 1 ? "e" : ""} ausgewählt
                </p>
              )}
              <NavButtons isFirst={isFirst} isLast={isLast} onBack={goBack} onNext={goNext} />
            </div>
          )}

          {/* ── Step 5: Zusammenfassung ── */}
          {currentStep === 5 && (
            <div>
              <div className="space-y-4">
                {/* Person */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Mitarbeiter</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">
                      {step1.firstName} {step1.lastName}
                    </span>
                    {step1.email && (
                      <>
                        <span className="text-muted-foreground">E-Mail</span>
                        <span>{step1.email}</span>
                      </>
                    )}
                    {step1.position && (
                      <>
                        <span className="text-muted-foreground">Position</span>
                        <span>{step1.position}</span>
                      </>
                    )}
                    {step1.department && (
                      <>
                        <span className="text-muted-foreground">Abteilung</span>
                        <span>{step1.department}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Status</span>
                    <span>
                      {step1.status === "ACTIVE"
                        ? "Aktiv"
                        : step1.status === "DISABLED"
                          ? "Deaktiviert"
                          : "Ausgeschieden"}
                    </span>
                  </div>
                </div>

                {/* Location */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Standort & Arbeitsplatz</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Standort</span>
                    <span>{selectedLocation?.name ?? <span className="text-muted-foreground italic">Keiner</span>}</span>
                    <span className="text-muted-foreground">Arbeitsplatz</span>
                    <span>{selectedWorkstation?.name ?? <span className="text-muted-foreground italic">Keiner</span>}</span>
                  </div>
                </div>

                {/* Devices */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Geräte</span>
                  </div>
                  {selectedDeviceIds.size === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Keine Geräte zugewiesen</p>
                  ) : (
                    <ul className="space-y-1">
                      {availableDevices
                        .filter((d) => selectedDeviceIds.has(d.id))
                        .map((d) => (
                          <li key={d.id} className="text-sm flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-primary" />
                            {d.name}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                {/* Software */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Software</span>
                  </div>
                  {selectedSoftwareIds.size === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Keine Software zugewiesen</p>
                  ) : (
                    <ul className="space-y-1">
                      {availableSoftware
                        .filter((s) => selectedSoftwareIds.has(s.id))
                        .map((s) => (
                          <li key={s.id} className="text-sm flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-primary" />
                            {s.name}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              <NavButtons
                isFirst={isFirst}
                isLast={isLast}
                onBack={goBack}
                onNext={handleFinalSubmit}
                nextLabel="Mitarbeiter anlegen"
                loading={loading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
