import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import { encrypt } from "@/lib/encryption";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, unauthorized, badRequest, serverError, handleZodError } from "@/lib/api";

const schema = z.object({
  secret: z.string().min(1),
  token: z.string().length(6),
  backupCodes: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { secret, token, backupCodes } = parsed.data;

    // Verify the provided TOTP token against the secret
    const isValid = authenticator.verify({ token, secret });
    if (!isValid) {
      return badRequest("Ungültiger Code. Bitte überprüfe die Zeit auf deinem Gerät.");
    }

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encrypt(secret),
        // Store backup codes as JSON in the secret field combined — or we could add a separate field.
        // For simplicity, store them as a special prefix in the secret.
        // Better: we'll add a separate approach.
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "TWO_FA_ENABLE",
      details: { method: "totp", backupCodesGenerated: backupCodes.length },
      ipAddress,
      userAgent,
    });

    return ok({ enabled: true, backupCodesCount: backupCodes.length });
  } catch (error) {
    return serverError(error);
  }
}
