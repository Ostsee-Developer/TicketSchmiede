import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { canManageUserPasskeys } from "@/lib/passkey-admin";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { userId } = await params;
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const passkeyId = url.searchParams.get("passkeyId");
    const access = await canManageUserPasskeys({
      actorId: session.user.id,
      actorIsSuperAdmin: session.user.isSuperAdmin,
      targetUserId: userId,
      tenantId,
    });
    if (!access.allowed || !access.target) return forbidden();

    const result = await prisma.passkeyCredential.deleteMany({
      where: { userId, ...(passkeyId ? { id: passkeyId } : {}) },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: access.tenantId,
      action: "DELETE",
      resource: "PasskeyCredential",
      details: { targetUserId: userId, targetUserEmail: access.target.email, deleted: result.count },
      ipAddress,
      userAgent,
    });

    return ok({ deleted: result.count });
  } catch (error) {
    return serverError(error);
  }
}
