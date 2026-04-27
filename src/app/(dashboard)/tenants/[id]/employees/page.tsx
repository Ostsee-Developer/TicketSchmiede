import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { Plus, Wand2, Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  return { title: `${tenant?.name ?? ""} – Mitarbeiter` };
}

const statusBadgeVariant = (status: string) =>
  ({ ACTIVE: "success", DISABLED: "muted", LEFT: "destructive" } as const)[status] ?? "muted";

const statusLabel = (s: string) =>
  ({ ACTIVE: "Aktiv", DISABLED: "Deaktiviert", LEFT: "Ausgeschieden" }[s] ?? s);

export default async function TenantEmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = await resolveTenantContext(id);
  if (!ctx) redirect("/dashboard");

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const where = {
    tenantId: id,
    ...(sp.status ? { status: sp.status as "ACTIVE" } : {}),
    ...(sp.search
      ? {
          OR: [
            { firstName: { contains: sp.search, mode: "insensitive" as const } },
            { lastName: { contains: sp.search, mode: "insensitive" as const } },
            { email: { contains: sp.search, mode: "insensitive" as const } },
            { department: { contains: sp.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      location: { select: { name: true } },
      workstation: { select: { name: true } },
      _count: { select: { devices: true, credentials: true } },
    },
  });

  const statusFilters = [
    { label: "Alle", status: undefined },
    { label: "Aktiv", status: "ACTIVE" },
    { label: "Deaktiviert", status: "DISABLED" },
    { label: "Ausgeschieden", status: "LEFT" },
  ];

  return (
    <div>
      <PageHeader
        title="Mitarbeiter"
        subtitle={`${employees.length} Einträge${sp.status ? ` · gefiltert nach ${statusLabel(sp.status)}` : ""}`}
        breadcrumbs={[
          { label: tenant.name, href: `/tenants/${id}/dashboard` },
          { label: "Mitarbeiter" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/tenants/${id}/employees/wizard`}
              className="inline-flex items-center gap-1.5 text-sm font-medium border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 px-3 py-2 rounded-lg transition-all"
            >
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">Wizard</span>
            </Link>
            <Link
              href={`/tenants/${id}/employees/new`}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Neuer Mitarbeiter</span>
              <span className="sm:hidden">Neu</span>
            </Link>
          </div>
        }
      />

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        {statusFilters.map((f) => {
          const isActive = sp.status === f.status || (!sp.status && !f.status);
          return (
            <Link
              key={f.label}
              href={`/tenants/${id}/employees${f.status ? `?status=${f.status}` : ""}`}
              className={[
                "text-sm px-3 py-1.5 rounded-lg font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
              ].join(" ")}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {employees.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">Keine Mitarbeiter gefunden</p>
          <p className="text-sm text-muted-foreground mb-4">
            {sp.status ? "Versuche einen anderen Filter" : "Lege den ersten Mitarbeiter an"}
          </p>
          <Link
            href={`/tenants/${id}/employees/wizard`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-all"
          >
            <Wand2 className="w-4 h-4" />
            Mit Wizard anlegen
          </Link>
        </div>
      ) : (
        <>
          {/* ── Desktop Table ── */}
          <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Position / Abteilung
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    E-Mail
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Standort
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Geräte
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {e.firstName[0]}{e.lastName[0]}
                        </div>
                        <span className="font-medium text-foreground">
                          {e.lastName}, {e.firstName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[e.position, e.department].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{e.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {e.location?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground text-sm">
                      {e._count.devices}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(e.status)} dot>
                        {statusLabel(e.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/tenants/${id}/employees/${e.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        Details
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Card List ── */}
          <div className="lg:hidden rounded-xl border border-border bg-card overflow-hidden shadow-card divide-y divide-border">
            {employees.map((e) => (
              <Link
                key={e.id}
                href={`/tenants/${id}/employees/${e.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {e.firstName[0]}{e.lastName[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {e.firstName} {e.lastName}
                    </p>
                    <Badge variant={statusBadgeVariant(e.status)} size="sm" dot>
                      {statusLabel(e.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {[e.position, e.department].filter(Boolean).join(" · ") || (e.email ?? "—")}
                  </p>
                  {(e.location || e._count.devices > 0) && (
                    <div className="flex items-center gap-2 mt-1">
                      {e.location && (
                        <span className="text-2xs text-muted-foreground/70">{e.location.name}</span>
                      )}
                      {e._count.devices > 0 && (
                        <span className="text-2xs text-muted-foreground/70">
                          {e._count.devices} Gerät{e._count.devices !== 1 ? "e" : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
