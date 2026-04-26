import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, created, unauthorized, forbidden, serverError, handleZodError, getPagination } from "@/lib/api";

const schema = z.object({
  tenantId: z.string().cuid(),
  locationId: z.string().cuid().optional().nullable(),
  employeeId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100),
  room: z.string().optional().nullable(),
  networkOutlet: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return forbidden("tenantId erforderlich");

    const ctx = await resolveTenantContext(tenantId);
    if (!ctx) return unauthorized();

    const { skip, limit, page } = getPagination(url);
    const search = url.searchParams.get("search") ?? "";

    const where = {
      tenantId,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.workstation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          location: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          devices: { select: { id: true, type: true, manufacturer: true, model: true } },
        },
      }),
      prisma.workstation.count({ where }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const ctx = await resolveTenantContext(parsed.data.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    const ws = await prisma.workstation.create({ data: parsed.data });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREATE",
      resource: "Workstation",
      resourceId: ws.id,
      details: { name: ws.name },
      ipAddress,
      userAgent,
    });

    return created(ws);
  } catch (error) {
    return serverError(error);
  }
}
