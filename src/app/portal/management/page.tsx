import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal-context";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Verwaltung – TicketSchmiede" };

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
      status: true,
      department: true,
      position: true,
      devices: {
        select: { id: true, type: true, manufacturer: true, model: true, inventoryNumber: true },
        orderBy: { inventoryNumber: "asc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Management / Verwaltung</h1>
          <p className="text-sm text-gray-500">Benutzerverwaltung und ausgegebene Technik ohne technische Detaildaten.</p>
        </div>
        <Link href="/portal/employees" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Mitarbeiterübersicht</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Mitarbeiter</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Bereich</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Ausgegebene Technik</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((employee) => (
              <tr key={employee.id} className="align-top">
                <td className="px-4 py-3"><p className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</p><p className="text-xs text-gray-500">Status: {employee.status}</p></td>
                <td className="px-4 py-3 text-gray-700">{employee.department ?? "—"}{employee.position ? <p className="text-xs text-gray-500">{employee.position}</p> : null}</td>
                <td className="px-4 py-3">
                  {employee.devices.length === 0 ? <span className="text-gray-400">Keine Geräte</span> : (
                    <ul className="space-y-1">
                      {employee.devices.map((device) => (<li key={device.id} className="text-gray-700">{device.type}{device.inventoryNumber ? ` · Inventar ${device.inventoryNumber}` : ""}{(device.manufacturer || device.model) ? ` (${device.manufacturer ?? ""} ${device.model ?? ""})` : ""}</li>))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
