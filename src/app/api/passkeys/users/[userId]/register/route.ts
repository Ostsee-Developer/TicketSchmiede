import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { badRequest, forbidden, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { canManageUserPasskeys } from "@/lib/passkey-admin";
import { getWebAuthnRequestInfo, verifyRegistrationResponse } from "@/lib/webauthn";

const schema = z.object({
  name: z.string().max(80).optional(),
  credential: z.object({
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      transports: z.array(z.string()).optional(),
    }),
  }),
});

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

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const challenge = await prisma.webAuthnChallenge.findFirst({
      where: { userId, type: "admin_registration", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) return badRequest("Passkey-Anfrage ist abgelaufen. Bitte erneut starten.");

    const rp = getWebAuthnRequestInfo(request);
    const verified = verifyRegistrationResponse({
      credential: parsed.data.credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      rpId: rp.rpId,
    });

    const passkey = await prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId: verified.credentialId,
        publicKey: verified.publicKey,
        counter: verified.counter,
        transports: verified.transports.join(","),
        name: parsed.data.name || "Passkey",
      },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    });

    await prisma.webAuthnChallenge.deleteMany({ where: { userId, type: "admin_registration" } });
    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: access.tenantId,
      action: "PASSKEY_REGISTER",
      resource: "PasskeyCredential",
      resourceId: passkey.id,
      details: { targetUserId: userId, targetUserEmail: access.target.email },
      ipAddress,
      userAgent,
    });

    return ok(passkey);
  } catch (error) {
    return serverError(error);
  }
}
