import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError, noContent } from "@/lib/api";

const updateSchema = z.object({
  locationId: z.string().cuid().optional().nullable(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "DISABLED", "LEFT"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return notFound();

    const ctx = await resolveTenantContext(employee.tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewEmployees(ctx.role)) return forbidden();

    const full = await prisma.employee.findUnique({
      where: { id },
      include: {
        location: true,
        workstation: { select: { id: true, name: true, room: true } },
        devices: {
          select: { id: true, type: true, manufacturer: true, model: true, status: true },
        },
        software: {
          include: { software: { select: { id: true, name: true, version: true } } },
        },
        credentials: {
          select: {
            id: true,
            name: true,
            username: true,
            category: true,
            expiresAt: true,
            lastRotatedAt: true,
            // Never return encrypted password in list
          },
        },
      },
    });

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
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return notFound();

    const ctx = await resolveTenantContext(employee.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageEmployees(ctx.role)) return forbidden();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "UPDATE",
      resource: "Employee",
      resourceId: id,
      details: { changes: Object.keys(parsed.data) },
      ipAddress,
      userAgent,
    });

    return ok(updated);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return notFound();

    const ctx = await resolveTenantContext(employee.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageEmployees(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.employee.delete({ where: { id } });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "DELETE",
      resource: "Employee",
      resourceId: id,
      details: { name: `${employee.firstName} ${employee.lastName}` },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
