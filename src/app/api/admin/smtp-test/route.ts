import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { forbidden, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import { sendPlainEmail } from "@/lib/notifications/email";

const schema = z.object({
  to: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    await sendPlainEmail({
      to: parsed.data.to,
      subject: "Ticket Schmiede SMTP-Test",
      html: "<p>SMTP ist korrekt eingerichtet. Diese Testmail wurde von Ticket Schmiede versendet.</p>",
      text: "SMTP ist korrekt eingerichtet. Diese Testmail wurde von Ticket Schmiede versendet.",
    });

    return ok({ sent: true });
  } catch (error) {
    return serverError(error);
  }
}
