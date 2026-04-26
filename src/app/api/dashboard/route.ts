import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return forbidden("tenantId erforderlich");

    const ctx = await resolveTenantContext(tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewAdminDashboard(ctx.role)) return forbidden();

    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      ticketStats,
      expiringLicenses,
      expiringWarranties,
      devicesWithoutAssignment,
      employeesWithoutWorkstation,
      recentActivity,
    ] = await Promise.all([
      // Ticket stats by status and priority
      prisma.ticket.groupBy({
        by: ["status", "priority"],
        where: { tenantId },
        _count: true,
      }),

      // Licenses expiring in 90 days
      prisma.software.findMany({
        where: {
          tenantId,
          validUntil: { gte: now, lte: ninetyDays },
        },
        orderBy: { validUntil: "asc" },
        take: 10,
      }),

      // Warranties expiring in 90 days
      prisma.device.findMany({
        where: {
          tenantId,
          warrantyUntil: { gte: now, lte: ninetyDays },
          status: "ACTIVE",
        },
        orderBy: { warrantyUntil: "asc" },
        take: 10,
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      }),

      // Devices without employee or workstation
      prisma.device.count({
        where: {
          tenantId,
          status: "ACTIVE",
          employeeId: null,
          workstationId: null,
        },
      }),

      // Active employees without workstation
      prisma.employee.count({
        where: {
          tenantId,
          status: "ACTIVE",
          workstation: null,
        },
      }),

      // Recent audit log entries for this tenant
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          userEmail: true,
          createdAt: true,
        },
      }),
    ]);

    // Aggregate ticket stats
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let openTickets = 0;

    for (const stat of ticketStats) {
      byStatus[stat.status] = (byStatus[stat.status] ?? 0) + stat._count;
      byPriority[stat.priority] = (byPriority[stat.priority] ?? 0) + stat._count;
      if (!["RESOLVED", "CLOSED"].includes(stat.status)) {
        openTickets += stat._count;
      }
    }

    return ok({
      openTickets,
      criticalTickets: byPriority["CRITICAL"] ?? 0,
      ticketsByStatus: byStatus,
      ticketsByPriority: byPriority,
      expiringLicenses: expiringLicenses.map((s) => ({
        ...s,
        daysUntilExpiry: Math.ceil(
          (s.validUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      expiringWarranties: expiringWarranties.map((d) => ({
        ...d,
        daysUntilExpiry: Math.ceil(
          (d.warrantyUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      devicesWithoutAssignment,
      employeesWithoutWorkstation,
      recentActivity,
    });
  } catch (error) {
    return serverError(error);
  }
}
