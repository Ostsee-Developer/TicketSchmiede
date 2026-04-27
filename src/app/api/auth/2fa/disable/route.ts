import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import bcrypt from "bcryptjs";
import { safeDecrypt } from "@/lib/encryption";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, unauthorized, badRequest, forbidden, serverError, handleZodError } from "@/lib/api";

const schema = z.object({
  password: z.string().min(1),
  token: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { password, token } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) return unauthorized();
    if (!user.twoFactorEnabled) return badRequest("2FA ist nicht aktiviert.");

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) return forbidden("Falsches Passwort.");

    if (user.twoFactorSecret) {
      const secret = safeDecrypt(user.twoFactorSecret);
      if (!secret || !authenticator.verify({ token, secret })) {
        return badRequest("Ungültiger Authentifizierungscode.");
      }
    }

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "TWO_FA_DISABLE",
      details: { disabledBy: "self" },
      ipAddress,
      userAgent,
    });

    return ok({ disabled: true });
  } catch (error) {
    return serverError(error);
  }
}
