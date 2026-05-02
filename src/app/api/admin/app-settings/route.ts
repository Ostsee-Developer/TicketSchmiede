import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { forbidden, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import { getAppBranding, setAppBranding } from "@/lib/app-settings";

const brandingSchema = z.object({
  appName: z.string().min(1).max(80),
  loginSubtitle: z.string().min(1).max(140),
  loginHeadline: z.string().min(1).max(120),
  loginHighlight: z.string().min(1).max(120),
  loginDescription: z.string().min(1).max(300),
  loginFooter: z.string().min(1).max(160),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    return ok({ branding: await getAppBranding() });
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
    const parsed = brandingSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    return ok({ branding: await setAppBranding(parsed.data) });
  } catch (error) {
    return serverError(error);
  }
}
