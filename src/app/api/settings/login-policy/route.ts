import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { forbidden, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import { getLoginPolicy, normalizeLoginPolicy, setLoginPolicy } from "@/lib/security-settings";

const schema = z.object({
  policy: z.enum(["PASSWORD_AND_PASSKEY", "PASSWORD_ONLY", "PASSKEY_ONLY"]),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    return ok({ policy: await getLoginPolicy() });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const policy = await setLoginPolicy(normalizeLoginPolicy(parsed.data.policy));
    return ok({ policy });
  } catch (error) {
    return serverError(error);
  }
}
