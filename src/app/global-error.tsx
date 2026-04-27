"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="de">
      <body className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Kritischer Fehler</h1>
          <p className="text-slate-400 mb-2">Ein unerwarteter Fehler ist aufgetreten.</p>
          {error.digest && (
            <p className="text-slate-600 text-xs mb-6 font-mono">Fehler-ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
