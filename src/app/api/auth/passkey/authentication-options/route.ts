import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, handleZodError, ok, serverError } from "@/lib/api";
import { getLoginPolicy, passkeyLoginAllowed } from "@/lib/security-settings";
import {
  getWebAuthnRequestInfo,
  newChallenge,
  publicKeyCredentialRequestOptions,
} from "@/lib/webauthn";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const policy = await getLoginPolicy();
    if (!passkeyLoginAllowed(policy)) return badRequest("Passkey-Anmeldung ist deaktiviert.");

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        isActive: true,
        passkeys: { select: { credentialId: true } },
      },
    });

    if (!user?.isActive || user.passkeys.length === 0) {
      return badRequest("Für diesen Benutzer ist kein Passkey eingerichtet.");
    }

    const challenge = newChallenge();
    await prisma.webAuthnChallenge.create({
      data: {
        challenge,
        userId: user.id,
        type: "authentication",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const rp = getWebAuthnRequestInfo(request);
    return ok({
      options: publicKeyCredentialRequestOptions({
        challenge,
        rpId: rp.rpId,
        allowCredentialIds: user.passkeys.map((passkey) => passkey.credentialId),
      }),
    });
  } catch (error) {
    return serverError(error);
  }
}
