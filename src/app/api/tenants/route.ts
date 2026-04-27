import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, created, unauthorized, forbidden, badRequest, serverError, handleZodError, getPagination } from "@/lib/api";

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  street: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default("DE"),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { user } = session;
    const url = new URL(request.url);
    const { skip, limit, page } = getPagination(url);
    const search = url.searchParams.get("search") ?? "";

    // Only internal users (super admin, internal admin, technician) can list tenants
    if (!user.isSuperAdmin) {
      // Return only tenants the user has access to
      const userRoles = await prisma.userTenantRole.findMany({
        where: { userId: user.id },
        include: {
          tenant: true,
        },
      });

      const tenants = userRoles
        .map((r) => r.tenant)
        .filter((t) =>
          search
            ? t.name.toLowerCase().includes(search.toLowerCase())
            : true
        );

      return ok({ data: tenants, total: tenants.length, page: 1, limit: tenants.length, totalPages: 1 });
    }

    const baseWhere = { deletedAt: null };
    const [data, total] = await Promise.all([
      prisma.tenant.findMany({
        where: search
          ? { ...baseWhere, name: { contains: search, mode: "insensitive" } }
          : baseWhere,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { employees: true, tickets: true, devices: true },
          },
        },
      }),
      prisma.tenant.count({
        where: search
          ? { ...baseWhere, name: { contains: search, mode: "insensitive" } }
          : baseWhere,
      }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return badRequest("Dieser Slug ist bereits vergeben");

    const tenant = await prisma.tenant.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        website: parsed.data.website || null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: tenant.id,
      action: "CREATE",
      resource: "Tenant",
      resourceId: tenant.id,
      details: { name: tenant.name },
      ipAddress,
      userAgent,
    });

    return created(tenant);
  } catch (error) {
    return serverError(error);
  }
}
