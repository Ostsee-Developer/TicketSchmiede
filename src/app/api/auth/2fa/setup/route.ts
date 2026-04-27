import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { ok, unauthorized, serverError } from "@/lib/api";
import { randomBytes } from "crypto";

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
  );
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true, email: true, name: true },
    });
    if (!user) return unauthorized();

    // Generate a new TOTP secret (don't save yet — only saved on enable)
    const secret = authenticator.generateSecret();
    const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Ticket Schmiede";
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    const backupCodes = generateBackupCodes();

    // Store temp secret encrypted in session (we pass it back to client for the enable step)
    // The secret is only committed on successful verify
    return ok({
      secret,
      qrDataUrl,
      otpauthUrl,
      backupCodes,
      alreadyEnabled: user.twoFactorEnabled,
    });
  } catch (error) {
    return serverError(error);
  }
}
