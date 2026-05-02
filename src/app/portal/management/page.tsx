import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Laptop, MapPin, type LucideIcon, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal-context";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Verwaltung - TicketSchmiede" };

type EmployeeWithDevices = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  department: string | null;
  position: string | null;
  location: { name: string } | null;
  devices: {
    id: string;
    type: string;
    manufacturer: string | null;
    model: string | null;
    inventoryNumber: string | null;
  }[];
};

export default async function PortalManagementPage() {
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");
  if (!ctx.isCustomerAdmin) notFound();

  const employees = await prisma.employee.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      department: true,
      position: true,
      location: { select: { name: true } },
      devices: {
        select: { id: true, type: true, manufacturer: true, model: true, inventoryNumber: true },
        orderBy: { inventoryNumber: "asc" },
      },
    },
  });

  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE").length;
  const assignedDevices = employees.reduce((count, employee) => count + employee.devices.length, 0);
  const departments = new Set(employees.map((employee) => employee.department).filter(Boolean)).size;
  const locations = new Set(employees.map((employee) => employee.location?.name).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{ctx.tenantName}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Verwaltung</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Mitarbeiter, Bereiche und ausgegebene Technik auf einen Blick.
          </p>
        </div>
        <Link
          href="/portal/employees"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          Mitarbeiter
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} label="Aktive Mitarbeiter" value={activeEmployees} subValue={`${employees.length} gesamt`} />
        <MetricCard icon={Laptop} label="Ausgegebene Technik" value={assignedDevices} subValue="zugewiesene Assets" />
        <MetricCard icon={BriefcaseBusiness} label="Bereiche" value={departments} subValue="Abteilungen" />
        <MetricCard icon={MapPin} label="Standorte" value={locations} subValue="mit Mitarbeitern" />
      </div>

      {employees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 text-sm font-semibold text-gray-900">Keine Mitarbeiter gefunden</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sobald Mitarbeiter angelegt sind, erscheint hier die Verwaltungsübersicht.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {employees.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Mitarbeiter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Bereich</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Standort</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Ausgegebene Technik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="align-top transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Initials firstName={employee.firstName} lastName={employee.lastName} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-950">{employee.firstName} {employee.lastName}</p>
                            <p className="truncate text-xs text-gray-500">{employee.email ?? statusLabel(employee.status)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <p>{employee.department ?? "-"}</p>
                        {employee.position ? <p className="text-xs text-gray-500">{employee.position}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{employee.location?.name ?? "-"}</td>
                      <td className="px-4 py-3">
                        <DeviceList devices={employee.devices} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  subValue: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subValue}</p>
    </div>
  );
}

function EmployeeCard({ employee }: { employee: EmployeeWithDevices }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Initials firstName={employee.firstName} lastName={employee.lastName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-950">{employee.firstName} {employee.lastName}</p>
              {employee.email ? <p className="truncate text-xs text-gray-500">{employee.email}</p> : null}
            </div>
            <StatusPill status={employee.status} />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-gray-500">
            <p>{employee.department ?? "Kein Bereich"}{employee.position ? ` - ${employee.position}` : ""}</p>
            <p>{employee.location?.name ?? "Kein Standort"}</p>
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <DeviceList devices={employee.devices} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Initials({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">
      {firstName[0]}{lastName[0]}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
      {statusLabel(status)}
    </span>
  );
}

function DeviceList({ devices }: { devices: EmployeeWithDevices["devices"] }) {
  if (devices.length === 0) {
    return <span className="text-sm text-gray-400">Keine Geräte</span>;
  }

  return (
    <ul className="space-y-1.5">
      {devices.map((device) => (
        <li key={device.id} className="rounded-md bg-gray-50 px-2.5 py-2 text-gray-700">
          <p className="font-medium">{device.type}</p>
          <p className="text-xs text-gray-500">
            {[device.inventoryNumber ? `Inventar ${device.inventoryNumber}` : null, [device.manufacturer, device.model].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" - ") || "Keine weiteren Angaben"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function statusLabel(status: string) {
  return status === "ACTIVE" ? "Aktiv" : status === "DISABLED" ? "Inaktiv" : "Ausgeschieden";
}
