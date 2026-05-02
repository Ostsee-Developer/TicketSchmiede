import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { badRequest, created, forbidden, handleZodError, serverError, unauthorized } from "@/lib/api";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { createAccountSetupToken, getAppUrl } from "@/lib/account-setup";
import { sendPlainEmail } from "@/lib/notifications/email";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  tenantId: z.string().cuid(),
  role: z.enum(["INTERNAL_ADMIN", "TECHNICIAN", "CUSTOMER_ADMIN", "CUSTOMER_USER", "READ_ONLY"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return badRequest("E-Mail bereits vergeben");

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        passwordHash: await bcrypt.hash(cryptoRandomPassword(), 12),
        isActive: true,
        tenantRoles: {
          create: {
            tenantId: parsed.data.tenantId,
            role: parsed.data.role,
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    const token = await createAccountSetupToken(user.id);
    const setupUrl = `${getAppUrl().replace(/\/$/, "")}/setup-account?token=${encodeURIComponent(token)}`;

    await sendPlainEmail({
      to: user.email,
      subject: "Willkommen bei Ticket Schmiede",
      html: `<p>Hallo ${user.name},</p><p>dein Konto wurde angelegt. Bitte richte hier dein Passwort, Passkey und Profil ein:</p><p><a href="${setupUrl}">${setupUrl}</a></p><p>Der Link ist 7 Tage gültig.</p>`,
      text: `Hallo ${user.name},\n\nrichte dein Konto ein: ${setupUrl}\n\nDer Link ist 7 Tage gültig.`,
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: parsed.data.tenantId,
      action: "CREATE",
      resource: "User",
      resourceId: user.id,
      details: { email: user.email, invited: true, role: parsed.data.role },
      ipAddress,
      userAgent,
    });

    return created({ user, invited: true });
  } catch (error) {
    return serverError(error);
  }
}

function cryptoRandomPassword() {
  return crypto.randomBytes(32).toString("hex");
}
