import type { NotificationPayload } from "./types";
import { getSmtpRuntimeConfig } from "@/lib/system-settings";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: string;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const stored = await getSmtpRuntimeConfig();
  if (stored) return stored;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? user ?? "";

  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    from,
  };
}

function buildEmailHtml(payload: NotificationPayload): { subject: string; html: string } {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Ticket Schmiede";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const d = payload.data;
  const tenant = payload.tenantName ? ` — ${payload.tenantName}` : "";

  const titles: Record<string, string> = {
    "ticket.created": "Neues Ticket erstellt",
    "ticket.updated": "Ticket aktualisiert",
    "ticket.resolved": "Ticket gelöst",
    "ticket.closed": "Ticket geschlossen",
    "ticket.comment": "Neuer Kommentar",
    "device.warranty_expiring": "Garantie läuft bald ab",
    "software.license_expiring": "Lizenz läuft bald ab",
    "user.locked": "Benutzer gesperrt",
  };

  const title = titles[payload.event] ?? payload.event;
  const subject = `${appName}${tenant}: ${title}`;

  const ticketLink =
    d.tenantId && d.id
      ? `${appUrl}/tenants/${d.tenantId}/tickets/${d.id}`
      : null;

  let body = "";
  switch (payload.event) {
    case "ticket.created":
    case "ticket.updated":
    case "ticket.resolved":
    case "ticket.closed":
      body = `
        <p><strong>Ticket #${d.number}:</strong> ${d.title}</p>
        <p>Priorität: <strong>${d.priority}</strong> | Status: <strong>${d.status}</strong></p>
        ${ticketLink ? `<p><a href="${ticketLink}" style="color:#2563eb">Ticket öffnen →</a></p>` : ""}
      `;
      break;
    case "ticket.comment":
      body = `<p>Neuer Kommentar zu Ticket #${d.number}: ${d.title}</p>`;
      break;
    case "device.warranty_expiring":
      body = `<p>${d.manufacturer} ${d.model} — Garantie läuft in <strong>${d.daysLeft} Tagen</strong> ab.</p>`;
      break;
    case "software.license_expiring":
      body = `<p>${d.name} (${d.vendor}) — Lizenz läuft in <strong>${d.daysLeft} Tagen</strong> ab.</p>`;
      break;
    case "user.locked":
      body = `<p>Benutzer <strong>${d.email}</strong> wurde nach ${d.attempts} fehlgeschlagenen Anmeldeversuchen gesperrt.</p>`;
      break;
    default:
      body = `<pre style="font-size:12px">${JSON.stringify(d, null, 2)}</pre>`;
  }

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1e40af;padding:20px 24px">
      <p style="color:white;font-size:18px;font-weight:700;margin:0">${appName}</p>
      ${payload.tenantName ? `<p style="color:#93c5fd;font-size:13px;margin:2px 0 0">${payload.tenantName}</p>` : ""}
    </div>
    <div style="padding:24px">
      <h2 style="font-size:16px;color:#111827;margin:0 0 12px">${title}</h2>
      <div style="font-size:14px;color:#374151;line-height:1.6">${body}</div>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="font-size:12px;color:#9ca3af;margin:0">${new Date(payload.timestamp).toLocaleString("de-DE")} · ${appName}</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

export async function sendEmailNotification(
  payload: NotificationPayload,
  recipients: string[]
): Promise<void> {
  const config = await getSmtpConfig();
  if (!config || recipients.length === 0) return;

  const { subject, html } = buildEmailHtml(payload);

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });

    await transporter.sendMail({
      from: config.from,
      to: recipients.join(", "),
      subject,
      html,
    });
  } catch (error) {
    console.error("[Email] Failed to send notification email:", error);
  }
}

export async function sendPlainEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}) {
  const config = await getSmtpConfig();
  if (!config) throw new Error("SMTP ist nicht konfiguriert.");

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.sendMail({
    from: config.from,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
    text,
  });
}
