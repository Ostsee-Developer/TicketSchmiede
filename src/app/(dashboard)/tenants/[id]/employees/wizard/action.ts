"use server";

import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface EmployeeWizardData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  position?: string;
  department?: string;
  status: string;
  startDate?: string;
  notes?: string;
  locationId?: string;
  workstationId?: string;
  deviceIds: string[];
  softwareIds: string[];
}

export async function createEmployeeFromWizard(
  tenantId: string,
  data: EmployeeWizardData,
): Promise<{ ok: boolean; employeeId?: string; error?: string }> {
  const ctx = await resolveTenantContext(tenantId);
  if (!ctx) return { ok: false, error: "Mandant nicht gefunden" };
  if (!can.manageEmployees(ctx.role)) return { ok: false, error: "Keine Berechtigung" };

  try {
    const employee = await prisma.employee.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        position: data.position || null,
        department: data.department || null,
        status: (data.status || "ACTIVE") as "ACTIVE" | "DISABLED" | "LEFT",
        startDate: data.startDate ? new Date(`${data.startDate}T00:00:00.000Z`) : null,
        notes: data.notes || null,
        locationId: data.locationId || null,
        workstationId: data.workstationId || null,
      },
    });

    if (data.deviceIds.length > 0) {
      await prisma.device.updateMany({
        where: { id: { in: data.deviceIds }, tenantId },
        data: { assignedToId: employee.id },
      });
    }

    if (data.softwareIds.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO "_EmployeeSoftware" ("A", "B")
        SELECT ${employee.id}, s.id
        FROM "Software" s
        WHERE s.id = ANY(${data.softwareIds}::text[]) AND s."tenantId" = ${tenantId}
        ON CONFLICT DO NOTHING
      `;
    }

    await createAuditLog({
      userId: ctx.userId,
      tenantId,
      action: "CREATE",
      resource: "Employee",
      resourceId: employee.id,
      details: {
        name: `${employee.firstName} ${employee.lastName}`,
        wizard: true,
        deviceCount: data.deviceIds.length,
        softwareCount: data.softwareIds.length,
      },
    });

    revalidatePath(`/tenants/${tenantId}/employees`);

    return { ok: true, employeeId: employee.id };
  } catch (error) {
    console.error("Wizard create employee error:", error);
    return { ok: false, error: "Fehler beim Anlegen des Mitarbeiters" };
  }
}
