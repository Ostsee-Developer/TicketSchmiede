import { ok, serverError } from "@/lib/api";
import { getAppBranding } from "@/lib/app-settings";

export async function GET() {
  try {
    return ok(await getAppBranding());
  } catch (error) {
    return serverError(error);
  }
}
