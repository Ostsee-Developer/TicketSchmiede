import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError, noContent } from "@/lib/api";

const updateSchema = z.object({
  locationId: z.string().cuid().optional().nullable(),
  employeeId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100).optional(),
  room: z.string().optional().nullable(),
  networkOutlet: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workstation = await prisma.workstation.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        devices: { select: { id: true, type: true, manufacturer: true, model: true, status: true } },
      },
    });
    if (!workstation) return notFound();

    const ctx = await resolveTenantContext(workstation.tenantId);
    if (!ctx) return unauthorized();

    return ok(workstation);
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
    const workstation = await prisma.workstation.findUnique({ where: { id } });
    if (!workstation) return notFound();

    const ctx = await resolveTenantContext(workstation.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const updated = await prisma.workstation.update({ where: { id }, data: parsed.data });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "UPDATE",
      resource: "Workstation",
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
    const workstation = await prisma.workstation.findUnique({ where: { id } });
    if (!workstation) return notFound();

    const ctx = await resolveTenantContext(workstation.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.workstation.delete({ where: { id } });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "DELETE",
      resource: "Workstation",
      resourceId: id,
      details: { name: workstation.name },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
