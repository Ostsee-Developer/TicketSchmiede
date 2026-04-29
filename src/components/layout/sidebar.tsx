"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  Users,
  MapPin,
  Monitor,
  Cpu,
  Code2,
  KeyRound,
  Building2,
  UserCog,
  ScrollText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Search,
  Settings,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  tenantId?: string;
  tenantName?: string;
  isSuperAdmin?: boolean;
  userName?: string;
  userEmail?: string;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  onOpenSearch?: () => void;
}

export function Sidebar({
  tenantId,
  tenantName,
  isSuperAdmin,
  userName,
  userEmail,
  collapsed = false,
  mobileOpen = false,
  onToggleCollapse,
  onCloseMobile,
  onOpenSearch,
}: SidebarProps) {
  const pathname = usePathname();

  const routeTenantId = pathname.match(/^\/tenants\/([^/]+)/)?.[1];
  const effectiveTenantId =
    tenantId ?? (routeTenantId && routeTenantId !== "new" ? routeTenantId : undefined);
  const base = effectiveTenantId ? `/tenants/${effectiveTenantId}` : "";

  const mainItems: NavItem[] = [
    {
      label: "Dashboard",
      href: effectiveTenantId ? `${base}/dashboard` : "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Tickets",
      href: effectiveTenantId ? `${base}/tickets` : "/tickets",
      icon: Ticket,
    },
    ...(effectiveTenantId
      ? [
          { label: "Mitarbeiter", href: `${base}/employees`, icon: Users },
          { label: "Standorte", href: `${base}/locations`, icon: MapPin },
          { label: "Arbeitsplätze", href: `${base}/workstations`, icon: Monitor },
          { label: "Geräte", href: `${base}/devices`, icon: Cpu },
          { label: "Software", href: `${base}/software`, icon: Code2 },
          { label: "Zugangsdaten", href: `${base}/credentials`, icon: KeyRound },
        ]
      : []),
  ];

  const adminItems: NavItem[] = [
    ...(isSuperAdmin ? [{ label: "Mandanten", href: "/tenants", icon: Building2 }] : []),
    { label: "Benutzer", href: "/users", icon: UserCog },
    { label: "Audit-Log", href: "/audit-log", icon: ScrollText },
    { label: "Sicherheit", href: "/settings/security", icon: Settings },
  ];

  const sections: NavSection[] = [
    { items: mainItems },
    { title: "Administration", items: adminItems },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const userInitials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar shadow-sidebar",
        "transition-all duration-250 ease-in-out",
        /* mobile: slide in/out */
        "lg:relative lg:translate-x-0 lg:z-auto",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        /* desktop: collapsed = icon-only */
        collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
        /* mobile always full width */
        "w-72",
      )}
      aria-label="Hauptnavigation"
    >
      {/* ── Logo / Brand ── */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary shrink-0">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-sidebar-foreground leading-tight truncate">
              Ticket Schmiede
            </p>
            {tenantName && (
              <p className="text-2xs text-sidebar-foreground/50 truncate">{tenantName}</p>
            )}
          </div>
        )}
        {/* Mobile close */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="ml-auto lg:hidden p-1.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            aria-label="Sidebar schließen"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Search ── */}
      {onOpenSearch && (
        <div className="px-2 py-2 border-b border-sidebar-border">
          <button
            onClick={onOpenSearch}
            title={collapsed ? "Suchen (Ctrl+K)" : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
              "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "lg:justify-center lg:px-0",
            )}
            aria-label="Suchen"
          >
            <Search className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Suchen…</span>
                <kbd className="hidden lg:inline-block text-2xs bg-sidebar-accent px-1.5 py-0.5 rounded font-mono opacity-60">⌘K</kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "pt-3 mt-2 border-t border-sidebar-border" : ""}>
            {section.title && !collapsed && (
              <p className="px-3 mb-1.5 text-2xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "lg:justify-center lg:px-0",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] shrink-0 transition-all",
                      active ? "opacity-100" : "opacity-75 group-hover:opacity-100",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge != null && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-2xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User + Collapse ── */}
      <div className="shrink-0 border-t border-sidebar-border p-2 space-y-1">
        {/* User info */}
        {userName && (
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{userName}</p>
                {userEmail && (
                  <p className="text-2xs text-sidebar-foreground/50 truncate">{userEmail}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Abmelden" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
            "text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-red-400 transition-all",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
              "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Sidebar erweitern" : "Sidebar einklappen"}
          >
            {collapsed ? (
              <ChevronRight className="w-[18px] h-[18px]" />
            ) : (
              <>
                <ChevronLeft className="w-[18px] h-[18px]" />
                <span>Einklappen</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
