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
  workstationId: z.string().cuid().optional().nullable(),
  type: z.enum(["LAPTOP", "PC", "SERVER", "PRINTER", "FIREWALL", "SWITCH", "ROUTER", "SMARTPHONE", "TABLET", "MONITOR", "DOCKING_STATION", "NAS", "ACCESS_POINT", "UPS", "OTHER"]).optional(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  inventoryNumber: z.string().optional().nullable(),
  purchaseDate: z.string().datetime().optional().nullable(),
  warrantyUntil: z.string().datetime().optional().nullable(),
  os: z.string().optional().nullable(),
  osVersion: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  macAddress: z.string().optional().nullable(),
  hostname: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "IN_STORAGE", "IN_REPAIR", "DECOMMISSIONED", "LOST"]).optional(),
  notes: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        files: { select: { id: true, filename: true, size: true, createdAt: true } },
      },
    });
    if (!device) return notFound();

    const ctx = await resolveTenantContext(device.tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewDevices(ctx.role)) return forbidden();

    return ok(device);
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
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return notFound();

    const ctx = await resolveTenantContext(device.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...parsed.data,
        purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : undefined,
        warrantyUntil: parsed.data.warrantyUntil ? new Date(parsed.data.warrantyUntil) : undefined,
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "UPDATE",
      resource: "Device",
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
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) return notFound();

    const ctx = await resolveTenantContext(device.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.device.delete({ where: { id } });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "DELETE",
      resource: "Device",
      resourceId: id,
      details: { type: device.type, manufacturer: device.manufacturer, model: device.model },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
