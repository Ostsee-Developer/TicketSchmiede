"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Etwas ist schiefgelaufen</h1>
        <p className="text-gray-500 mb-6">
          {error.message && process.env.NODE_ENV === "development"
            ? error.message
            : "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Erneut versuchen
          </button>
          <Link
            href="/dashboard"
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
