import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAppBranding } from "@/lib/app-settings";
import { getLoginPolicy } from "@/lib/security-settings";
import { getBackupSettings, getSmtpSettings } from "@/lib/system-settings";
import { SystemSettingsClient } from "./SystemSettingsClient";

export const metadata = { title: "Systemeinstellungen" };

export default async function SystemSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  const [branding, policy, smtp, backup] = await Promise.all([
    getAppBranding(),
    getLoginPolicy(),
    getSmtpSettings(),
    getBackupSettings(),
  ]);

  return (
    <SystemSettingsClient
      initialBranding={branding}
      initialPolicy={policy}
      initialSmtp={smtp}
      initialBackup={backup}
    />
  );
}
