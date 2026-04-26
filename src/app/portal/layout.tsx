import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-gray-800">Ticket Schmiede</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">Kundenportal</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/portal/tickets"
              className="text-sm text-gray-600 hover:text-blue-700 font-medium"
            >
              Meine Tickets
            </Link>
            <Link
              href="/portal/tickets/new"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              + Ticket erstellen
            </Link>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">
                Abmelden
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
