import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { noContent, serverError, unauthorized } from "@/lib/api";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    await prisma.passkeyCredential.deleteMany({
      where: { id, userId: session.user.id },
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
