import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can, isCustomerRole } from "@/lib/permissions";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError } from "@/lib/api";

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  status: z.enum(["NEW", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  category: z.enum(["HARDWARE", "SOFTWARE", "EMAIL", "NETWORK", "USER_ACCOUNT", "PRINTER", "PHONE", "VPN", "OTHER"]).optional(),
  technicianId: z.string().cuid().optional().nullable(),
  employeeId: z.string().cuid().optional().nullable(),
  workstationId: z.string().cuid().optional().nullable(),
  deviceId: z.string().cuid().optional().nullable(),
  timeSpent: z.number().int().min(0).optional(),
  internalNotes: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return notFound();

    const ctx = await resolveTenantContext(ticket.tenantId);
    if (!ctx) return unauthorized();

    // Customers can only view their own tickets
    if (isCustomerRole(ctx.role) && ticket.createdById !== ctx.userId) {
      return forbidden();
    }

    const full = await prisma.ticket.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        device: { select: { id: true, type: true, manufacturer: true, model: true } },
        technician: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        comments: {
          where: isCustomerRole(ctx.role) ? { isInternal: false } : {},
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        files: {
          select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
        },
      },
    });

    // Strip internalNotes for customers
    if (isCustomerRole(ctx.role) && full) {
      const { internalNotes: _in, ...safeTicket } = full;
      return ok(safeTicket);
    }

    return ok(full);
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return notFound();

    const ctx = await resolveTenantContext(ticket.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageTickets(ctx.role)) return forbidden();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const data: Record<string, unknown> = { ...parsed.data };

    if (parsed.data.status === "RESOLVED" && ticket.status !== "RESOLVED") {
      data.resolvedAt = new Date();
    }
    if (parsed.data.status === "CLOSED" && ticket.status !== "CLOSED") {
      data.closedAt = new Date();
    }

    const updated = await prisma.ticket.update({ where: { id }, data });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "UPDATE",
      resource: "Ticket",
      resourceId: id,
      details: { changes: Object.keys(parsed.data), number: ticket.number },
      ipAddress,
      userAgent,
    });

    return ok(updated);
  } catch (error) {
    return serverError(error);
  }
}
