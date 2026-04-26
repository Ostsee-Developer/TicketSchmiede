import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { ok, created, unauthorized, forbidden, serverError, handleZodError, getPagination } from "@/lib/api";

const createEmployeeSchema = z.object({
  tenantId: z.string().cuid(),
  locationId: z.string().cuid().optional().nullable(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "DISABLED", "LEFT"]).default("ACTIVE"),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
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
    const status = url.searchParams.get("status");

    const isSensitiveAllowed = can.viewEmployees(ctx.role);

    const where = {
      tenantId,
      ...(status ? { status: status as "ACTIVE" | "DISABLED" | "LEFT" } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { department: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          // Sensitive fields only for internal users
          ...(isSensitiveAllowed
            ? {
                email: true,
                phone: true,
                mobile: true,
                position: true,
                department: true,
                locationId: true,
                location: { select: { id: true, name: true } },
                externalRef: true,
                createdAt: true,
                updatedAt: true,
              }
            : {}),
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const ctx = await resolveTenantContext(parsed.data.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageEmployees(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    const employee = await prisma.employee.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREATE",
      resource: "Employee",
      resourceId: employee.id,
      details: { name: `${employee.firstName} ${employee.lastName}` },
      ipAddress,
      userAgent,
    });

    return created(employee);
  } catch (error) {
    return serverError(error);
  }
}
