import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canManageUserPasskeys } from "@/lib/passkey-admin";
import {
  getWebAuthnRequestInfo,
  newChallenge,
  publicKeyCredentialCreationOptions,
} from "@/lib/webauthn";

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

    const passkeys = await prisma.passkeyCredential.findMany({
      where: { userId },
      select: { credentialId: true },
    });
    const challenge = newChallenge();
    await prisma.webAuthnChallenge.create({
      data: {
        challenge,
        userId,
        type: "admin_registration",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const rp = getWebAuthnRequestInfo(request);
    return ok({
      options: publicKeyCredentialCreationOptions({
        challenge,
        userId,
        userName: access.target.email,
        userDisplayName: access.target.name,
        rp,
        excludeCredentialIds: passkeys.map((passkey) => passkey.credentialId),
      }),
    });
  } catch (error) {
    return serverError(error);
  }
}
