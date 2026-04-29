import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

interface EntityCardProps {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  avatar?: React.ReactNode;
  avatarFallback?: string;
  avatarColor?: string;
  href?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function EntityCard({
  title,
  subtitle,
  meta,
  badge,
  avatar,
  avatarFallback,
  avatarColor = "bg-primary/10 text-primary",
  href,
  onClick,
  actions,
  className,
}: EntityCardProps) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-card",
        "transition-all duration-200",
        (href || onClick) && "hover:shadow-card-hover hover:border-primary/30 cursor-pointer",
        className,
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
          avatarColor,
        )}
      >
        {avatar ?? (avatarFallback ?? "?")}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-foreground truncate">{title}</p>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
        {meta && <div className="mt-1">{meta}</div>}
      </div>

      {/* Actions */}
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {inner}
      </button>
    );
  }

  return inner;
}
