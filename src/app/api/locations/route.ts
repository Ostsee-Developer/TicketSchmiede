import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  serverError,
  handleZodError,
  getPagination,
} from "@/lib/api";

const createSchema = z.object({
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(100),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().default("DE"),
  notes: z.string().optional().nullable(),
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

    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { city: { contains: search, mode: "insensitive" as const } },
              { street: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.location.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { employees: true, devices: true, workstations: true },
          },
        },
      }),
      prisma.location.count({ where }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const ctx = await resolveTenantContext(parsed.data.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageDevices(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    const location = await prisma.location.create({
      data: {
        tenantId: parsed.data.tenantId,
        name: parsed.data.name,
        street: parsed.data.street ?? null,
        city: parsed.data.city ?? null,
        zipCode: parsed.data.zipCode ?? null,
        country: parsed.data.country,
        notes: parsed.data.notes ?? null,
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREATE",
      resource: "Location",
      resourceId: location.id,
      details: { name: location.name },
      ipAddress,
      userAgent,
    });

    return created(location);
  } catch (error) {
    return serverError(error);
  }
}
