import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { canManageUserPasskeys } from "@/lib/passkey-admin";
import { sendPasskeyResetEmail } from "@/lib/passkey-email";

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { userId } = await params;
    const tenantId = new URL(request.url).searchParams.get("tenantId");
    const access = await canManageUserPasskeys({
      actorId: session.user.id,
      actorIsSuperAdmin: session.user.isSuperAdmin,
      targetUserId: userId,
      tenantId,
    });
    if (!access.allowed || !access.target) return forbidden();

    const deleted = await prisma.passkeyCredential.deleteMany({ where: { userId } });
    let emailSent = false;
    try {
      emailSent = await sendPasskeyResetEmail({
        to: access.target.email,
        name: access.target.name,
        resetBy: session.user.email,
      });
    } catch (error) {
      console.error("[PasskeyResetEmail] Failed to send reset email:", error);
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: access.tenantId,
      action: "DELETE",
      resource: "PasskeyCredential",
      details: {
        targetUserId: userId,
        targetUserEmail: access.target.email,
        deleted: deleted.count,
        emailSent,
      },
      ipAddress,
      userAgent,
    });

    return ok({ deleted: deleted.count, emailSent });
  } catch (error) {
    return serverError(error);
  }
}
