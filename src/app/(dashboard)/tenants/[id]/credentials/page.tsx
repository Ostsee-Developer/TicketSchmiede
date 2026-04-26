"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DeleteButton } from "@/components/ui/DeleteButton";

interface Credential {
  id: string;
  name: string;
  username: string | null;
  category: string | null;
  url: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  employee: { firstName: string; lastName: string } | null;
}

export default function CredentialsPage() {
  const params = useParams<{ id: string }>();
  const tenantId = params.id;
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealLoading, setRevealLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/credentials?tenantId=${tenantId}`)
      .then((r) => r.json())
      .then((d) => { setCredentials(d.data?.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tenantId]);

  const revealPassword = async (id: string) => {
    if (revealedPasswords[id]) {
      const updated = { ...revealedPasswords };
      delete updated[id];
      setRevealedPasswords(updated);
      return;
    }

    setRevealLoading(id);
    try {
      const res = await fetch(`/api/credentials/${id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (data.data?.password) {
        setRevealedPasswords((prev) => ({ ...prev, [id]: data.data.password }));
      }
    } finally {
      setRevealLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zugangsdaten</h1>
          <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Passwortanzeige wird protokolliert
          </p>
        </div>
        <Link
          href={`/tenants/${tenantId}/credentials/new`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Eintrag
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Laden...
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Keine Zugangsdaten vorhanden
            </div>
          )}
          {credentials.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {c.category && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {c.category}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    {c.username && (
                      <div>
                        <span className="text-gray-400 text-xs">Benutzername</span>
                        <p className="font-mono text-gray-800 text-xs">{c.username}</p>
                      </div>
                    )}
                    {c.hasPassword && (
                      <div>
                        <span className="text-gray-400 text-xs">Passwort</span>
                        <div className="flex items-center gap-2">
                          {revealedPasswords[c.id] ? (
                            <p className="font-mono text-gray-800 text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                              {revealedPasswords[c.id]}
                            </p>
                          ) : (
                            <p className="font-mono text-gray-300 text-xs">••••••••••</p>
                          )}
                          <button
                            onClick={() => revealPassword(c.id)}
                            disabled={revealLoading === c.id}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {revealLoading === c.id
                              ? "..."
                              : revealedPasswords[c.id]
                              ? "Verbergen"
                              : "Anzeigen"}
                          </button>
                        </div>
                      </div>
                    )}
                    {c.employee && (
                      <div>
                        <span className="text-gray-400 text-xs">Mitarbeiter</span>
                        <p className="text-gray-700 text-xs">
                          {c.employee.firstName} {c.employee.lastName}
                        </p>
                      </div>
                    )}
                  </div>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-1 inline-block truncate max-w-xs"
                    >
                      {c.url}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/tenants/${tenantId}/credentials/${c.id}`} className="text-xs text-gray-400 hover:text-blue-600">Bearbeiten</Link>
                  <DeleteButton apiPath={`/api/credentials/${c.id}`} confirmText={`${c.name} löschen?`} onSuccess={() => { setCredentials((prev) => prev.filter((x) => x.id !== c.id)); }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
