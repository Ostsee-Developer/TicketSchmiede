import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { encrypt } from "@/lib/encryption";
import { ok, created, unauthorized, forbidden, serverError, handleZodError, getPagination } from "@/lib/api";

const createSchema = z.object({
  tenantId: z.string().cuid(),
  employeeId: z.string().cuid().optional().nullable(),
  templateId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(200),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  category: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return forbidden("tenantId erforderlich");

    const ctx = await resolveTenantContext(tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewCredentials(ctx.role)) return forbidden();

    const { skip, limit, page } = getPagination(url);
    const search = url.searchParams.get("search") ?? "";
    const employeeId = url.searchParams.get("employeeId");

    const where = {
      tenantId,
      ...(employeeId ? { employeeId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { username: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.credential.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          tenantId: true,
          employeeId: true,
          templateId: true,
          name: true,
          username: true,
          url: true,
          category: true,
          expiresAt: true,
          lastRotatedAt: true,
          externalRef: true,
          createdAt: true,
          updatedAt: true,
          // Indicate if a password exists without revealing it
          encryptedPassword: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          template: { select: { id: true, name: true } },
        },
      }),
      prisma.credential.count({ where }),
    ]);

    // Map: replace encryptedPassword with hasPassword flag
    const safeData = data.map(({ encryptedPassword, ...rest }) => ({
      ...rest,
      hasPassword: !!encryptedPassword,
    }));

    return ok({ data: safeData, total, page, limit, totalPages: Math.ceil(total / limit) });
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
    if (!can.manageCredentials(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);
    const { password, notes, ...rest } = parsed.data;

    const credential = await prisma.credential.create({
      data: {
        ...rest,
        url: rest.url || null,
        encryptedPassword: password ? encrypt(password) : null,
        encryptedNotes: notes ? encrypt(notes) : null,
        expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : null,
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREDENTIAL_CREATE",
      resource: "Credential",
      resourceId: credential.id,
      details: { name: credential.name, employeeId: credential.employeeId },
      ipAddress,
      userAgent,
    });

    // Return without encrypted password
    const { encryptedPassword: _ep, encryptedNotes: _en, ...safeCredential } = credential;
    return created({ ...safeCredential, hasPassword: !!_ep });
  } catch (error) {
    return serverError(error);
  }
}
