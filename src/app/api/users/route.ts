import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, created, unauthorized, forbidden, badRequest, serverError, handleZodError } from "@/lib/api";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(12, "Passwort muss mindestens 12 Zeichen lang sein"),
  isSuperAdmin: z.boolean().default(false),
  tenantId: z.string().cuid().optional(),
  role: z.enum(["SUPER_ADMIN", "INTERNAL_ADMIN", "TECHNICIAN", "CUSTOMER_ADMIN", "CUSTOMER_USER", "READ_ONLY"]).optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        isActive: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        tenantRoles: {
          include: { tenant: { select: { id: true, name: true } } },
        },
      },
    });

    return ok(users);
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
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return badRequest("E-Mail bereits vergeben");

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        isSuperAdmin: parsed.data.isSuperAdmin,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Assign tenant role if provided
    if (parsed.data.tenantId && parsed.data.role) {
      await prisma.userTenantRole.create({
        data: {
          userId: user.id,
          tenantId: parsed.data.tenantId,
          role: parsed.data.role,
        },
      });
    }

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "CREATE",
      resource: "User",
      resourceId: user.id,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });

    return created(user);
  } catch (error) {
    return serverError(error);
  }
}
