import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, iconPosition = "left", id, ...props }, ref) => {
    const inputId = id ?? React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
            {props.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === "left" && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 flex items-center justify-center">
              {icon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm",
              "placeholder:text-muted-foreground",
              "transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
              error && "border-destructive focus-visible:ring-destructive/30",
              icon && iconPosition === "left" && "pl-9",
              icon && iconPosition === "right" && "pr-9",
              className,
            )}
            {...props}
          />
          {icon && iconPosition === "right" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 flex items-center justify-center">
              {icon}
            </span>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        {!error && hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id ?? React.useId();

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {props.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm",
            "placeholder:text-muted-foreground resize-none",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
            error && "border-destructive focus-visible:ring-destructive/30",
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        {!error && hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? React.useId();

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {props.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm",
            "transition-colors appearance-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
            error && "border-destructive focus-visible:ring-destructive/30",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        {!error && hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Input, Textarea, Select };
