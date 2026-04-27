import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  href?: string;
  variant?: "default" | "danger" | "warning" | "success" | "info";
}

const variantStyles = {
  default: {
    icon: "bg-primary/10 text-primary",
    value: "text-foreground",
  },
  danger: {
    icon: "bg-red-50 text-red-600",
    value: "text-red-700",
  },
  warning: {
    icon: "bg-amber-50 text-amber-600",
    value: "text-amber-700",
  },
  success: {
    icon: "bg-green-50 text-green-600",
    value: "text-foreground",
  },
  info: {
    icon: "bg-blue-50 text-blue-600",
    value: "text-foreground",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  href,
  variant = "default",
}: StatCardProps) {
  const styles = variantStyles[variant];

  const content = (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover group">
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-sm font-medium text-muted-foreground leading-snug">{title}</p>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            styles.icon,
          )}
        >
          <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
        </div>
      </div>

      <p className={cn("text-3xl font-bold tabular-nums", styles.value)}>{value}</p>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-medium",
                trend.value > 0 ? "text-red-600" : "text-green-600",
              )}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </span>
          )}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
