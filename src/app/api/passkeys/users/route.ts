import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { listManageablePasskeyUsers } from "@/lib/passkey-admin";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const tenantId = new URL(request.url).searchParams.get("tenantId");
    const users = await listManageablePasskeyUsers({
      actorId: session.user.id,
      actorIsSuperAdmin: session.user.isSuperAdmin,
      tenantId,
    });

    if (!session.user.isSuperAdmin && !tenantId) return forbidden("Mandant erforderlich");
    return ok(users);
  } catch (error) {
    return serverError(error);
  }
}
