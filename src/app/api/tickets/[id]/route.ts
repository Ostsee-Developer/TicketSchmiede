import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { serializeTicket } from "@/lib/dto";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError } from "@/lib/api";
import { auth } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(1).optional(),
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

    const canViewAll = can.viewAllTenantTickets(ctx.role);

    // CUSTOMER_USER may only view their own tickets
    if (!canViewAll && ticket.createdById !== ctx.userId) {
      return forbidden();
    }

    const showInternalComments = can.viewInternalNotes(ctx.role);

    const full = await prisma.ticket.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        device: { select: { id: true, type: true, manufacturer: true, model: true } },
        technician: showInternalComments ? { select: { id: true, name: true, email: true } } : undefined,
        createdBy: { select: { id: true, name: true, email: true } },
        comments: {
          where: showInternalComments ? {} : { isInternal: false },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true } } },
        },
        files: {
          select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
        },
      },
    });

    if (!full) return notFound();

    return ok(serializeTicket(full, ctx.role));
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

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
      userEmail: session.user.email,
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
