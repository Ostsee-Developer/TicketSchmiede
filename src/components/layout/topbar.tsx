"use client";

import { Menu, Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface TopbarProps {
  onMenuClick: () => void;
  onSearchClick?: () => void;
}

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tickets": "Tickets",
  "/users": "Benutzer",
  "/tenants": "Mandanten",
  "/audit-log": "Audit-Log",
  "/admin": "System",
  "/settings/account": "Konto",
  "/settings/security": "Sicherheit",
};

function usePageTitle() {
  const pathname = usePathname();
  for (const [route, label] of Object.entries(routeLabels)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return label;
    }
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 3 && parts[0] === "tenants") {
    const section = parts[2];
    const labels: Record<string, string> = {
      dashboard: "Dashboard",
      employees: "Mitarbeiter",
      locations: "Standorte",
      workstations: "Arbeitsplätze",
      devices: "Geräte",
      software: "Software",
      credentials: "Zugangsdaten",
      tickets: "Tickets",
      settings: "Einstellungen",
    };
    return labels[section] ?? "Übersicht";
  }
  return "Ticket Schmiede";
}

export function Topbar({ onMenuClick, onSearchClick }: TopbarProps) {
  const title = usePageTitle();
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/notifications")
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled && payload?.success) setOpenTickets(payload.data.openTickets ?? 0);
        })
        .catch(() => undefined);
    };
    load();
    const interval = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-topbar-border bg-topbar px-4 lg:hidden">
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Menü öffnen"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <span className="flex-1 font-semibold text-sm text-foreground truncate">{title}</span>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSearchClick}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Suchen (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors relative"
          aria-label={`${openTickets} offene Benachrichtigungen`}
        >
          <Bell className="w-4 h-4" />
          {openTickets > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {openTickets > 9 ? "9+" : openTickets}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
