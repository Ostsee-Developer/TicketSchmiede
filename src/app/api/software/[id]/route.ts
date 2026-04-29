import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { serializeSoftware } from "@/lib/dto";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError, noContent } from "@/lib/api";
import { auth } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  vendor: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  licenseType: z.enum(["PERPETUAL", "SUBSCRIPTION", "VOLUME", "OEM", "FREEWARE", "OPEN_SOURCE", "TRIAL"]).optional(),
  licenseKey: z.string().optional().nullable(),
  licenseCount: z.number().int().positive().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  costCenter: z.string().optional().nullable(),
  purchasePrice: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const software = await prisma.software.findUnique({
      where: { id },
      include: {
        employees: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
        devices: { include: { device: { select: { id: true, type: true, manufacturer: true, model: true } } } },
      },
    });
    if (!software) return notFound();

    const ctx = await resolveTenantContext(software.tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewSoftware(ctx.role)) return forbidden();

    // Strip licenseKey for roles below INTERNAL_ADMIN (e.g. TECHNICIAN, READ_ONLY)
    return ok(serializeSoftware(software, ctx.role));
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
    const software = await prisma.software.findUnique({ where: { id } });
    if (!software) return notFound();

    const ctx = await resolveTenantContext(software.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageSoftware(ctx.role)) return forbidden();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const updated = await prisma.software.update({
      where: { id },
      data: {
        ...parsed.data,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : parsed.data.validFrom,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : parsed.data.validUntil,
      } as Parameters<typeof prisma.software.update>[0]["data"],
    });

    await createAuditLog({
      userId: ctx.userId,
      userEmail: session.user.email,
      tenantId: ctx.tenantId,
      action: "UPDATE",
      resource: "Software",
      resourceId: id,
      details: { changes: Object.keys(parsed.data) },
      ipAddress,
      userAgent,
    });

    return ok(serializeSoftware(updated, ctx.role));
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    const software = await prisma.software.findUnique({ where: { id } });
    if (!software) return notFound();

    const ctx = await resolveTenantContext(software.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageSoftware(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.software.delete({ where: { id } });

    await createAuditLog({
      userId: ctx.userId,
      userEmail: session.user.email,
      tenantId: ctx.tenantId,
      action: "DELETE",
      resource: "Software",
      resourceId: id,
      details: { name: software.name },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
