import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { forbidden, handleZodError, ok, serverError, unauthorized } from "@/lib/api";
import {
  getBackupSettings,
  getSmtpSettings,
  setBackupSettings,
  setSmtpSettings,
} from "@/lib/system-settings";

const smtpSchema = z.object({
  host: z.string().max(200),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().max(200),
  from: z.string().max(200),
  password: z.string().max(500).optional().or(z.literal("")),
});

const backupSchema = z.object({
  enabled: z.boolean(),
  directory: z.string().min(1).max(260),
  retentionDays: z.coerce.number().int().min(1).max(3650),
  includeAuditLog: z.boolean(),
  includeSecrets: z.boolean(),
  includeDatabase: z.boolean(),
  includeFiles: z.boolean(),
});

const patchSchema = z.object({
  smtp: smtpSchema.optional(),
  backup: backupSchema.optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const [smtp, backup] = await Promise.all([getSmtpSettings(), getBackupSettings()]);
    return ok({ smtp, backup });
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const [smtp, backup] = await Promise.all([
      parsed.data.smtp ? setSmtpSettings(parsed.data.smtp) : getSmtpSettings(),
      parsed.data.backup ? setBackupSettings(parsed.data.backup) : getBackupSettings(),
    ]);

    return ok({ smtp, backup });
  } catch (error) {
    return serverError(error);
  }
}
