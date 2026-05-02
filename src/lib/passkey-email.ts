export async function sendPasskeyResetEmail(params: {
  to: string;
  name: string;
  resetBy: string;
}) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? user ?? "";
  if (!host || !user || !pass || !from) return false;

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Ticket Schmiede";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const securityUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/settings/security` : "";
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: params.to,
    subject: `${appName}: Passkeys wurden zurückgesetzt`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5">
        <h2>Passkeys zurückgesetzt</h2>
        <p>Hallo ${escapeHtml(params.name)},</p>
        <p>deine Passkeys wurden von ${escapeHtml(params.resetBy)} zurückgesetzt.</p>
        <p>Bitte melde dich an und richte einen neuen Passkey ein.</p>
        ${securityUrl ? `<p><a href="${securityUrl}">Sicherheitseinstellungen öffnen</a></p>` : ""}
      </div>
    `,
  });

  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
