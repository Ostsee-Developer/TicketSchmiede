import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  tenantName,
  tenantId,
  section,
  title,
  subtitle,
  backHref,
  actions,
}: {
  tenantName: string;
  tenantId: string;
  section: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5" aria-label="Breadcrumb">
          <Link href={`/tenants/${tenantId}/dashboard`} className="hover:text-primary transition-colors">
            {tenantName}
          </Link>
          <ChevronRight className="w-3 h-3" />
          {backHref ? (
            <Link href={backHref} className="hover:text-primary transition-colors">
              {section}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{section}</span>
          )}
        </nav>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {(backHref || actions) && (
        <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">
          {actions}
          {backHref && !actions && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border bg-card hover:bg-accent px-3 py-2 rounded-lg transition-colors"
            >
              Zurück
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function TextInput({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </label>
  );
}

export function Textarea({
  label,
  name,
  defaultValue,
  rows = 4,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground resize-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
      />
    </label>
  );
}

export function SelectInput({
  label,
  name,
  defaultValue,
  options,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm transition-colors appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({ children = "Speichern" }: { children?: ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
    >
      {children}
    </button>
  );
}

export function DeleteButton({ children = "Löschen" }: { children?: ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-all active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

export function formatInputDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}
