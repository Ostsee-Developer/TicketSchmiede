"use server";

import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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
      },
    });

    // Link workstation → employee (relation lives on Workstation side)
    if (data.workstationId) {
      await prisma.workstation.updateMany({
        where: { id: data.workstationId, tenantId, employeeId: null },
        data: { employeeId: employee.id },
      });
    }

    // Assign devices to employee
    if (data.deviceIds.length > 0) {
      await prisma.device.updateMany({
        where: { id: { in: data.deviceIds }, tenantId },
        data: { employeeId: employee.id },
      });
    }

    // Create EmployeeSoftware join records
    if (data.softwareIds.length > 0) {
      await prisma.employeeSoftware.createMany({
        data: data.softwareIds.map((softwareId) => ({
          employeeId: employee.id,
          softwareId,
        })),
        skipDuplicates: true,
      });
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
