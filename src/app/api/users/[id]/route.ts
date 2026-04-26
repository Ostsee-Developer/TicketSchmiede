import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError } from "@/lib/api";

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  password: z.string().min(12, "Mindestens 12 Zeichen").optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const { id } = await params;
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return notFound("Benutzer nicht gefunden");

    const updateData: Parameters<typeof prisma.user.update>[0]["data"] = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.isSuperAdmin !== undefined) updateData.isSuperAdmin = parsed.data.isSuperAdmin;
    if (parsed.data.password) {
      updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
      updateData.failedLoginCount = 0;
      updateData.lockedUntil = null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        isActive: true,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "UPDATE",
      resource: "User",
      resourceId: id,
      details: { changes: Object.keys(updateData).filter((k) => k !== "passwordHash") },
      ipAddress,
      userAgent,
    });

    return ok(user);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const { id } = await params;
    if (id === session.user.id) return forbidden("Eigenen Account nicht löschbar");

    const { ipAddress, userAgent } = getClientInfo(request);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return notFound("Benutzer nicht gefunden");

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "DELETE",
      resource: "User",
      resourceId: id,
      details: { email: existing.email },
      ipAddress,
      userAgent,
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
