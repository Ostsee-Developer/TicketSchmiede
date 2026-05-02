import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { badRequest, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "Mindestens 12 Zeichen"),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) return unauthorized();

    const currentPasswordValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!currentPasswordValid) return badRequest("Das aktuelle Passwort ist nicht korrekt.");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      resource: "User",
      resourceId: user.id,
      details: { changes: ["password"] },
      ipAddress,
      userAgent,
    });

    return ok({ changed: true });
  } catch (error) {
    return serverError(error);
  }
}
