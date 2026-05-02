"use client";

import { type ReactNode, useState, useEffect, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "@/components/search/CommandPalette";

interface AppShellProps {
  children: ReactNode;
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
  const [searchOpen, setSearchOpen] = useState(false);

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
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background lg:h-auto lg:min-h-screen lg:overflow-visible">
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
        onOpenSearch={openSearch}
      />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col transition-all duration-250 lg:pl-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} onSearchClick={openSearch} />
        <main className="mobile-scroll-pane min-h-0 w-full flex-1 overflow-y-auto p-4 sm:p-6 lg:mx-auto lg:max-w-screen-2xl lg:overflow-visible">
          <div className="mobile-sticky-title">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette isOpen={searchOpen} onClose={closeSearch} />
    </div>
  );
}
