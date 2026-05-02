import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { Prisma, Role, AuditAction } from "@prisma/client";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit-Log" };

const actionLabel: Record<string, string> = {
  LOGIN: "Anmeldung",
  LOGOUT: "Abmeldung",
  LOGIN_FAILED: "Fehlgeschlagene Anmeldung",
  PASSKEY_REGISTER: "Passkey erstellt",
  PASSKEY_LOGIN: "Passkey-Anmeldung",
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
  LOGOUT: "bg-gray-100 text-gray-600",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  PASSKEY_REGISTER: "bg-indigo-100 text-indigo-700",
  PASSKEY_LOGIN: "bg-green-100 text-green-700",
  DELETE: "bg-red-100 text-red-700",
  CREDENTIAL_VIEW: "bg-yellow-100 text-yellow-700",
  CREDENTIAL_DELETE: "bg-red-100 text-red-700",
  EXPORT: "bg-blue-100 text-blue-700",
  IMPORT: "bg-purple-100 text-purple-700",
  PERMISSION_CHANGE: "bg-orange-100 text-orange-700",
  USER_LOCK: "bg-red-100 text-red-700",
  USER_UNLOCK: "bg-green-100 text-green-700",
  TWO_FA_ENABLE: "bg-teal-100 text-teal-700",
  TWO_FA_DISABLE: "bg-orange-100 text-orange-700",
};

// Build a URL preserving all current params, overriding specific keys
function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  return `?${params.toString()}`;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    action?: string;
    tenantId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.isSuperAdmin;

  // ── Access control ─────────────────────────────────────────────────────────
  // Non-superadmins must supply a tenantId and must have INTERNAL_ADMIN+ on it.
  // Without this guard, a non-admin could see ALL audit logs by omitting tenantId.

  let resolvedTenantId: string | undefined = sp.tenantId ?? undefined;

  if (!isSuperAdmin) {
    if (!resolvedTenantId) {
      // Auto-redirect to first tenant where user has INTERNAL_ADMIN access
      const firstRole = await prisma.userTenantRole.findFirst({
        where: {
          userId: session.user.id,
          role: { in: [Role.INTERNAL_ADMIN] },
        },
        select: { tenantId: true },
      });
      if (firstRole) {
        redirect(`/audit-log?tenantId=${firstRole.tenantId}`);
      }
      // No accessible tenant — show empty state below
      resolvedTenantId = undefined;
    } else {
      // Verify the user has INTERNAL_ADMIN+ on this specific tenant
      const userRole = await prisma.userTenantRole.findUnique({
        where: { userId_tenantId: { userId: session.user.id, tenantId: resolvedTenantId } },
      });
      if (!userRole || !can.viewAuditLog(userRole.role)) {
        redirect("/dashboard");
      }
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = 50;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
    ...(sp.action ? { action: sp.action as AuditAction } : {}),
    ...(sp.userId
      ? {
          OR: [
            { userId: sp.userId },
            { userEmail: { contains: sp.userId, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(sp.dateFrom || sp.dateTo
      ? {
          createdAt: {
            ...(sp.dateFrom ? { gte: new Date(sp.dateFrom + "T00:00:00.000Z") } : {}),
            ...(sp.dateTo ? { lte: new Date(sp.dateTo + "T23:59:59.999Z") } : {}),
          },
        }
      : {}),
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

  // Current param snapshot for URL building
  const currentParams: Record<string, string | undefined> = {
    tenantId: sp.tenantId,
    action: sp.action,
    userId: sp.userId,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit-Log</h1>
          <p className="text-gray-500 mt-1 text-sm">{total} Einträge</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        {/* Preserve tenantId + non-filter params as hidden inputs */}
        {sp.tenantId && <input type="hidden" name="tenantId" value={sp.tenantId} />}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Aktion</label>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Aktionen</option>
            {Object.entries(actionLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Benutzer (ID oder E-Mail)</label>
          <input
            type="text"
            name="userId"
            defaultValue={sp.userId ?? ""}
            placeholder="User-ID oder E-Mail"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Von</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.dateFrom ?? ""}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Bis</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.dateTo ?? ""}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filtern
        </button>

        {(sp.action || sp.userId || sp.dateFrom || sp.dateTo) && (
          <a
            href={sp.tenantId ? `?tenantId=${sp.tenantId}` : "?"}
            className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Zurücksetzen
          </a>
        )}
      </form>

      {/* Table */}
      <div className="grid gap-3 md:hidden">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-400">
            Keine Einträge gefunden
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      actionColor[log.action] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {actionLabel[log.action] ?? log.action}
                  </span>
                  <p className="mt-2 truncate text-sm font-semibold text-gray-950">
                    {log.userEmail ?? "System"}
                  </p>
                </div>
                <span className="shrink-0 text-right text-xs font-mono text-gray-400">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs">
                <div>
                  <p className="text-gray-400">Ressource</p>
                  <p className="mt-0.5 truncate text-gray-700">
                    {log.resource
                      ? `${log.resource}${log.resourceId ? ` #${log.resourceId.substring(0, 8)}` : ""}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">IP-Adresse</p>
                  <p className="mt-0.5 truncate font-mono text-gray-700">{log.ipAddress ?? "—"}</p>
                </div>
                {log.userAgent ? (
                  <div className="col-span-2">
                    <p className="text-gray-400">User-Agent</p>
                    <p className="mt-0.5 line-clamp-2 text-gray-600">{log.userAgent}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap w-36">Zeit</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap w-44">Aktion</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Benutzer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Ressource</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap w-32">IP-Adresse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  Keine Einträge gefunden
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      actionColor[log.action] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {actionLabel[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[180px]">
                  {log.userEmail ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[200px]">
                  {log.resource
                    ? `${log.resource}${log.resourceId ? ` #${log.resourceId.substring(0, 8)}` : ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">
                  {log.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Seite {page} von {totalPages} ({total} Einträge)
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={buildUrl(currentParams, { page: String(page - 1) })}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Zurück
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildUrl(currentParams, { page: String(page + 1) })}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
