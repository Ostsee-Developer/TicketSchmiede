import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import * as React from "react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  onClose?: () => void;
}

const alertConfig = {
  info: {
    icon: Info,
    classes: "bg-blue-50 border-blue-200 text-blue-800",
    iconClass: "text-blue-500",
  },
  success: {
    icon: CheckCircle2,
    classes: "bg-green-50 border-green-200 text-green-800",
    iconClass: "text-green-500",
  },
  warning: {
    icon: TriangleAlert,
    classes: "bg-amber-50 border-amber-200 text-amber-800",
    iconClass: "text-amber-500",
  },
  error: {
    icon: AlertCircle,
    classes: "bg-red-50 border-red-200 text-red-800",
    iconClass: "text-red-500",
  },
};

export function Alert({ variant = "info", title, onClose, children, className, ...props }: AlertProps) {
  const config = alertConfig[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm",
        config.classes,
        className,
      )}
      {...props}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconClass)} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
