import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, created, unauthorized, forbidden, serverError, handleZodError, getPagination } from "@/lib/api";

const schema = z.object({
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(200),
  vendor: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  licenseType: z.enum(["PERPETUAL", "SUBSCRIPTION", "VOLUME", "OEM", "FREEWARE", "OPEN_SOURCE", "TRIAL"]).default("PERPETUAL"),
  licenseKey: z.string().optional().nullable(),
  licenseCount: z.number().int().min(1).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  costCenter: z.string().optional().nullable(),
  purchasePrice: z.number().optional().nullable(),
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
    if (!can.viewSoftware(ctx.role)) return forbidden();

    const { skip, limit, page } = getPagination(url);
    const search = url.searchParams.get("search") ?? "";
    const expiringSoon = url.searchParams.get("expiringSoon") === "true";

    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const where = {
      tenantId,
      ...(expiringSoon ? { validUntil: { gte: now, lte: ninetyDays } } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { vendor: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.software.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          vendor: true,
          version: true,
          licenseType: true,
          licenseCount: true,
          validUntil: true,
          costCenter: true,
          externalRef: true,
          createdAt: true,
          // Never expose licenseKey in list view
          _count: { select: { employees: true, devices: true } },
        },
      }),
      prisma.software.count({ where }),
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
    if (!can.manageSoftware(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    const software = await prisma.software.create({
      data: {
        ...parsed.data,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
        purchasePrice: parsed.data.purchasePrice ? String(parsed.data.purchasePrice) : null,
      } as Parameters<typeof prisma.software.create>[0]["data"],
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREATE",
      resource: "Software",
      resourceId: software.id,
      details: { name: software.name },
      ipAddress,
      userAgent,
    });

    // Strip licenseKey from response
    const { licenseKey: _lk, ...safeSoftware } = software;
    return created(safeSoftware);
  } catch (error) {
    return serverError(error);
  }
}
