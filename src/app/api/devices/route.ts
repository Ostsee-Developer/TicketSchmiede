import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, created, unauthorized, forbidden, serverError, handleZodError, getPagination } from "@/lib/api";

const deviceSchema = z.object({
  tenantId: z.string().cuid(),
  locationId: z.string().cuid().optional().nullable(),
  employeeId: z.string().cuid().optional().nullable(),
  workstationId: z.string().cuid().optional().nullable(),
  type: z.enum(["LAPTOP", "PC", "SERVER", "PRINTER", "FIREWALL", "SWITCH", "ROUTER", "SMARTPHONE", "TABLET", "MONITOR", "DOCKING_STATION", "NAS", "ACCESS_POINT", "UPS", "OTHER"]),
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
  status: z.enum(["ACTIVE", "IN_STORAGE", "IN_REPAIR", "DECOMMISSIONED", "LOST"]).default("ACTIVE"),
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
    if (!can.viewDevices(ctx.role)) return forbidden();

    const { skip, limit, page } = getPagination(url);
    const search = url.searchParams.get("search") ?? "";
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");

    const where = {
      tenantId,
      ...(type ? { type: type as "LAPTOP" | "PC" } : {}),
      ...(status ? { status: status as "ACTIVE" } : {}),
      ...(search ? {
        OR: [
          { manufacturer: { contains: search, mode: "insensitive" as const } },
          { model: { contains: search, mode: "insensitive" as const } },
          { serialNumber: { contains: search, mode: "insensitive" as const } },
          { inventoryNumber: { contains: search, mode: "insensitive" as const } },
          { hostname: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.device.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ type: "asc" }, { manufacturer: "asc" }],
        include: {
          location: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          workstation: { select: { id: true, name: true } },
        },
      }),
      prisma.device.count({ where }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deviceSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const ctx = await resolveTenantContext(parsed.data.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    const device = await prisma.device.create({
      data: {
        ...parsed.data,
        purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : null,
        warrantyUntil: parsed.data.warrantyUntil ? new Date(parsed.data.warrantyUntil) : null,
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREATE",
      resource: "Device",
      resourceId: device.id,
      details: { type: device.type, manufacturer: device.manufacturer, model: device.model },
      ipAddress,
      userAgent,
    });

    return created(device);
  } catch (error) {
    return serverError(error);
  }
}
