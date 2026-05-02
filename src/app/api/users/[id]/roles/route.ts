import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, created, unauthorized, forbidden, notFound, serverError, handleZodError, noContent } from "@/lib/api";

const assignSchema = z.object({
  tenantId: z.string().cuid(),
  role: z.enum(["SUPER_ADMIN", "INTERNAL_ADMIN", "TECHNICIAN", "CUSTOMER_ADMIN", "CUSTOMER_USER", "READ_ONLY"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return notFound("Benutzer nicht gefunden");

    const roles = await prisma.userTenantRole.findMany({
      where: { userId: id },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: { tenant: { name: "asc" } },
    });

    return ok(roles);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return notFound("Benutzer nicht gefunden");

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const role = await prisma.$transaction(async (tx) => {
      await tx.userTenantRole.deleteMany({ where: { userId: id } });
      return tx.userTenantRole.create({
        data: { userId: id, tenantId: parsed.data.tenantId, role: parsed.data.role },
        include: { tenant: { select: { id: true, name: true } } },
      });
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: parsed.data.tenantId,
      action: "PERMISSION_CHANGE",
      resource: "UserTenantRole",
      resourceId: role.id,
      details: { targetUserId: id, targetUserEmail: user.email, role: parsed.data.role },
      ipAddress,
      userAgent,
    });

    return created(role);
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
    if (!session.user.isSuperAdmin) return forbidden();

    const { id } = await params;
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return notFound("tenantId erforderlich");

    const { ipAddress, userAgent } = getClientInfo(request);

    const existing = await prisma.userTenantRole.findUnique({
      where: { userId_tenantId: { userId: id, tenantId } },
    });
    if (!existing) return notFound("Rolle nicht gefunden");

    await prisma.userTenantRole.delete({
      where: { userId_tenantId: { userId: id, tenantId } },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId,
      action: "PERMISSION_CHANGE",
      resource: "UserTenantRole",
      resourceId: existing.id,
      details: { targetUserId: id, removed: true },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
