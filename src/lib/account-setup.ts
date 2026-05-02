import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function hashSetupToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAccountSetupToken(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.accountSetupToken.create({
    data: {
      userId,
      tokenHash: hashSetupToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
