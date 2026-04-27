import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden("Nur Super-Admins können 2FA zurücksetzen.");

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, twoFactorEnabled: true },
    });
    if (!user) return notFound("Benutzer nicht gefunden.");

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.user.update({
      where: { id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "TWO_FA_DISABLE",
      details: { targetUserId: id, targetEmail: user.email, disabledBy: "admin_reset" },
      ipAddress,
      userAgent,
    });

    return ok({ reset: true, userId: id });
  } catch (error) {
    return serverError(error);
  }
}
