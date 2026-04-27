"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 gap-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-red-100">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Fehler beim Laden</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          {process.env.NODE_ENV === "development" && error.message
            ? error.message
            : "Diese Seite konnte nicht geladen werden."}
        </p>
        {error.digest && (
          <p className="text-gray-400 text-xs mt-1 font-mono">ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Erneut versuchen
        </button>
        <Link
          href="/dashboard"
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
