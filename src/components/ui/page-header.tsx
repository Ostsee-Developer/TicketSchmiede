import Link from "next/link";
import { ChevronRight } from "lucide-react";
import * as React from "react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-primary transition-colors truncate max-w-[120px]">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium truncate max-w-[160px]">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">{actions}</div>
      )}
    </div>
  );
}
