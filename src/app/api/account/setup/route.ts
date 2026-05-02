import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { badRequest, handleZodError, ok, serverError } from "@/lib/api";
import { hashSetupToken } from "@/lib/account-setup";
import { getLoginPolicy } from "@/lib/security-settings";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(12).optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) return badRequest("Token fehlt.");

    const setup = await prisma.accountSetupToken.findUnique({
      where: { tokenHash: hashSetupToken(token) },
      include: { user: { select: { email: true, name: true, avatarUrl: true } } },
    });
    if (!setup || setup.usedAt || setup.expiresAt < new Date()) return badRequest("Einladungslink ist ungültig oder abgelaufen.");

    const policy = await getLoginPolicy();
    return ok({ user: setup.user, policy });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const setup = await prisma.accountSetupToken.findUnique({
      where: { tokenHash: hashSetupToken(parsed.data.token) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    if (!setup || setup.usedAt || setup.expiresAt < new Date()) return badRequest("Einladungslink ist ungültig oder abgelaufen.");

    const policy = await getLoginPolicy();
    if (policy !== "PASSKEY_ONLY" && !parsed.data.password) {
      return badRequest("Bitte ein Passwort mit mindestens 12 Zeichen setzen.");
    }

    await prisma.$transaction([
      ...(parsed.data.password
        ? [
            prisma.user.update({
              where: { id: setup.userId },
              data: {
                passwordHash: await bcrypt.hash(parsed.data.password, 12),
                failedLoginCount: 0,
                lockedUntil: null,
              },
            }),
          ]
        : []),
      prisma.accountSetupToken.update({
        where: { id: setup.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return ok({ completed: true, policy });
  } catch (error) {
    return serverError(error);
  }
}
