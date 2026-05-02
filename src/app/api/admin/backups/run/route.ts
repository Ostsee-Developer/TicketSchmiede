import { auth } from "@/lib/auth";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { createJsonBackup } from "@/lib/system-settings";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    return ok(await createJsonBackup());
  } catch (error) {
    return serverError(error);
  }
}
