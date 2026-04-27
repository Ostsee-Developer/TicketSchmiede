"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  sidebarProps: {
    tenantId?: string;
    tenantName?: string;
    isSuperAdmin?: boolean;
    userName?: string;
    userEmail?: string;
  };
}

const COLLAPSED_KEY = "sidebar-collapsed";

export function AppShell({ children, sidebarProps }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        {...sidebarProps}
        collapsed={mounted ? collapsed : false}
        mobileOpen={mobileOpen}
        onToggleCollapse={toggleCollapsed}
        onCloseMobile={closeMobile}
      />

      {/* Main area */}
      <div
        className={[
          "flex flex-1 flex-col min-w-0 transition-all duration-250",
          "lg:pl-0",
        ].join(" ")}
      >
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 max-w-screen-xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
