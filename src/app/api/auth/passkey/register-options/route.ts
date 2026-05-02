import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, serverError, unauthorized } from "@/lib/api";
import {
  getWebAuthnRequestInfo,
  newChallenge,
  publicKeyCredentialCreationOptions,
} from "@/lib/webauthn";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        passkeys: { select: { credentialId: true } },
      },
    });
    if (!user) return unauthorized();

    const challenge = newChallenge();
    await prisma.webAuthnChallenge.create({
      data: {
        challenge,
        userId: user.id,
        type: "registration",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const rp = getWebAuthnRequestInfo(request);
    return ok({
      options: publicKeyCredentialCreationOptions({
        challenge,
        userId: user.id,
        userName: user.email,
        userDisplayName: user.name,
        rp,
        excludeCredentialIds: user.passkeys.map((passkey) => passkey.credentialId),
      }),
    });
  } catch (error) {
    return serverError(error);
  }
}
