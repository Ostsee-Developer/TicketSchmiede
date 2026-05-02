import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { badRequest, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (!user) return unauthorized();

    return ok(user);
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email, id: { not: session.user.id } },
      select: { id: true },
    });
    if (existing) return badRequest("Diese E-Mail-Adresse wird bereits verwendet.");

    const before = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { email },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userEmail: user.email,
      action: "UPDATE",
      resource: "User",
      resourceId: user.id,
      details: { changes: ["email"], beforeEmail: before?.email, afterEmail: user.email },
      ipAddress,
      userAgent,
    });

    return ok(user);
  } catch (error) {
    return serverError(error);
  }
}
