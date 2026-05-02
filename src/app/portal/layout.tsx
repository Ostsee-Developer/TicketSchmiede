import { redirect } from "next/navigation";
import Link from "next/link";
import { getPortalContext } from "@/lib/portal-context";
import { PortalMobileNav } from "@/components/portal/portal-mobile-nav";
import { PortalUserMenu } from "@/components/portal/portal-user-menu";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/portal/tickets" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">TicketSchmiede</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/portal/tickets"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Tickets
            </Link>
            <Link
              href="/portal/tickets/new"
              className="ml-2 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neues Ticket
            </Link>
            {ctx.isCustomerAdmin && (
              <Link
                href="/portal/management"
                className="ml-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
              >
                Verwaltung
              </Link>
            )}
          </nav>

          {/* User menu (desktop) + sign-out form */}
          <PortalUserMenu
            userName={ctx.userName}
            userEmail={ctx.userEmail}
            tenantName={ctx.tenantName}
            roleLabel={ctx.roleLabel}
          />
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <PortalMobileNav isCustomerAdmin={ctx.isCustomerAdmin} />
    </div>
  );
}
