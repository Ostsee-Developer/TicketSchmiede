import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, serverError, unauthorized } from "@/lib/api";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const passkeys = await prisma.passkeyCredential.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    });

    return ok(passkeys);
  } catch (error) {
    return serverError(error);
  }
}
