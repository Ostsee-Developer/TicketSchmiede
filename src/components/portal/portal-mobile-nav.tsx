"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalMobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/portal/tickets"
      ? pathname === href || (pathname.startsWith("/portal/tickets") && !pathname.startsWith("/portal/tickets/new"))
      : pathname.startsWith(href);

  const navClass = (href: string) =>
    `flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors ${
      isActive(href) ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200">
      <div className="flex items-center justify-around h-16 safe-area-bottom">
        <Link href="/portal/tickets" className={navClass("/portal/tickets")}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive("/portal/tickets") ? 2.5 : 2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Tickets
        </Link>

        <Link href="/portal/tickets/new" className={navClass("/portal/tickets/new")}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center -mt-4 shadow-lg ${
            isActive("/portal/tickets/new") ? "bg-blue-700" : "bg-blue-600"
          }`}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="mt-1">Neu</span>
        </Link>
      </div>
    </nav>
  );
}
