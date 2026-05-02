import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const formData = await request.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) return badRequest("Kein Profilbild übertragen.");
    if (file.size > MAX_AVATAR_SIZE) return badRequest("Profilbild darf maximal 2 MB groß sein.");

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) return badRequest("Bitte JPG, PNG oder WebP verwenden.");

    const uploadRoot = process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(process.cwd(), "uploads");
    const uploadDir = path.join(uploadRoot, "avatars");
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${session.user.id}-${Date.now()}.${extension}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const avatarUrl = `/api/uploads/avatars/${fileName}`;
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      resource: "User",
      resourceId: user.id,
      details: { changes: ["avatarUrl"] },
      ipAddress,
      userAgent,
    });

    return ok(user);
  } catch (error) {
    return serverError(error);
  }
}
