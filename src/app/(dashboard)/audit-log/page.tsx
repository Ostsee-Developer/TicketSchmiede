import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit-Log" };

const actionLabel: Record<string, string> = {
  LOGIN: "Anmeldung",
  LOGOUT: "Abmeldung",
  LOGIN_FAILED: "Fehlgeschlagene Anmeldung",
  CREATE: "Erstellt",
  UPDATE: "Geändert",
  DELETE: "Gelöscht",
  EXPORT: "Export",
  IMPORT: "Import",
  CREDENTIAL_VIEW: "Passwort angezeigt",
  CREDENTIAL_CREATE: "Zugangsdaten erstellt",
  CREDENTIAL_UPDATE: "Zugangsdaten geändert",
  CREDENTIAL_DELETE: "Zugangsdaten gelöscht",
  PERMISSION_CHANGE: "Rechte geändert",
  USER_LOCK: "Benutzer gesperrt",
  USER_UNLOCK: "Benutzer entsperrt",
  TWO_FA_ENABLE: "2FA aktiviert",
  TWO_FA_DISABLE: "2FA deaktiviert",
  FILE_UPLOAD: "Datei hochgeladen",
  FILE_DELETE: "Datei gelöscht",
};

const actionColor: Record<string, string> = {
  LOGIN: "bg-green-100 text-green-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  DELETE: "bg-red-100 text-red-700",
  CREDENTIAL_VIEW: "bg-yellow-100 text-yellow-700",
  EXPORT: "bg-blue-100 text-blue-700",
  IMPORT: "bg-purple-100 text-purple-700",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; tenantId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = {
    ...(sp.tenantId ? { tenantId: sp.tenantId } : session.user.isSuperAdmin ? {} : undefined),
    ...(sp.action ? { action: sp.action as "LOGIN" } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit-Log</h1>
        <p className="text-gray-500 mt-1">{total} Einträge</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Zeit</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Aktion</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Benutzer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Ressource</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">IP-Adresse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Keine Einträge gefunden</td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                    {actionLabel[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{log.userEmail ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {log.resource ? `${log.resource}${log.resourceId ? ` (${log.resourceId.slice(0, 8)}...)` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Seite {page} von {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?page=${page - 1}${sp.action ? `&action=${sp.action}` : ""}`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ← Zurück
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?page=${page + 1}${sp.action ? `&action=${sp.action}` : ""}`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Weiter →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
