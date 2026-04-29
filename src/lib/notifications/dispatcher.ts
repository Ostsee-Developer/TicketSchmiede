import type { NotificationPayload, WebhookConfig } from "./types";
import { sendEmailNotification } from "./email";

/**
 * Dispatch a notification event to all configured webhooks.
 * Never throws — notification failures must not break the main flow.
 */
export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  const configs = getWebhookConfigs();
  const relevant = configs.filter(
    (c) => c.enabled && c.events.includes(payload.event)
  );

  const emailRecipients = getEmailRecipients(payload.event);

  await Promise.allSettled([
    ...relevant.map((config) => sendToWebhook(config, payload)),
    ...(emailRecipients.length > 0
      ? [sendEmailNotification(payload, emailRecipients).catch((e) => console.error("[Notifications] Email failed:", e))]
      : []),
  ]);
}

function getEmailRecipients(event: string): string[] {
  const envKey = "NOTIFICATION_EMAIL_RECIPIENTS";
  const envEvents = "NOTIFICATION_EMAIL_EVENTS";
  const recipients = process.env[envKey];
  if (!recipients) return [];

  const allowedEvents = process.env[envEvents]
    ? process.env[envEvents].split(",").map((e) => e.trim())
    : ["ticket.created", "ticket.resolved", "ticket.closed", "user.locked"];

  if (!allowedEvents.includes(event)) return [];
  return recipients.split(",").map((r) => r.trim()).filter(Boolean);
}

async function sendToWebhook(config: WebhookConfig, payload: NotificationPayload): Promise<void> {
  try {
    switch (config.type) {
      case "discord":
        await sendDiscord(config.url!, payload);
        break;
      case "telegram":
        await sendTelegram(config.botToken!, config.chatId!, payload);
        break;
      case "generic":
        await sendGeneric(config.url!, payload);
        break;
      case "email":
        if (config.email) {
          await sendEmailNotification(payload, [config.email]);
        }
        break;
      default:
        console.warn(`[Notifications] Unknown webhook type: ${config.type}`);
    }
  } catch (error) {
    console.error(`[Notifications] Failed to send ${config.type} notification:`, error);
  }
}

async function sendDiscord(webhookUrl: string, payload: NotificationPayload): Promise<void> {
  const embed = buildDiscordEmbed(payload);
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

function buildDiscordEmbed(payload: NotificationPayload) {
  const colors: Record<string, number> = {
    "ticket.created": 0x3b82f6,      // blue
    "ticket.updated": 0xa855f7,      // purple
    "ticket.resolved": 0x22c55e,     // green
    "ticket.closed": 0x6b7280,       // gray
    "ticket.comment": 0x8b5cf6,      // violet
    "device.warranty_expiring": 0xf59e0b,   // amber
    "software.license_expiring": 0xef4444,  // red
    "user.locked": 0xdc2626,         // red
  };

  return {
    title: formatEventTitle(payload.event),
    color: colors[payload.event] ?? 0x6b7280,
    description: formatEventDescription(payload),
    footer: {
      text: `Ticket Schmiede${payload.tenantName ? ` — ${payload.tenantName}` : ""}`,
    },
    timestamp: payload.timestamp,
  };
}

async function sendTelegram(botToken: string, chatId: string, payload: NotificationPayload): Promise<void> {
  const text = `*${formatEventTitle(payload.event)}*\n${formatEventDescription(payload)}`;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

async function sendGeneric(url: string, payload: NotificationPayload): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function formatEventTitle(event: string): string {
  const titles: Record<string, string> = {
    "ticket.created": "🎫 Neues Ticket erstellt",
    "ticket.updated": "✏️ Ticket aktualisiert",
    "ticket.resolved": "✅ Ticket gelöst",
    "ticket.closed": "🔒 Ticket geschlossen",
    "ticket.comment": "💬 Neuer Kommentar",
    "device.warranty_expiring": "⚠️ Garantie läuft ab",
    "software.license_expiring": "⚠️ Lizenz läuft ab",
    "user.locked": "🔐 Benutzer gesperrt",
  };
  return titles[event] ?? event;
}

function formatEventDescription(payload: NotificationPayload): string {
  const d = payload.data;
  switch (payload.event) {
    case "ticket.created":
    case "ticket.updated":
    case "ticket.resolved":
    case "ticket.closed":
      return `Ticket #${d.number}: ${d.title}\nPriorität: ${d.priority} | Status: ${d.status}`;
    case "ticket.comment":
      return `Kommentar zu Ticket #${d.number}: ${d.title}`;
    case "device.warranty_expiring":
      return `${d.manufacturer} ${d.model}\nGarantie läuft ab in ${d.daysLeft} Tagen`;
    case "software.license_expiring":
      return `${d.name} (${d.vendor})\nLizenz läuft ab in ${d.daysLeft} Tagen`;
    case "user.locked":
      return `Benutzer ${d.email} wurde nach ${d.attempts} fehlgeschlagenen Logins gesperrt`;
    default:
      return JSON.stringify(d, null, 2);
  }
}

function getWebhookConfigs(): WebhookConfig[] {
  const configs: WebhookConfig[] = [];

  if (process.env.DISCORD_WEBHOOK_URL) {
    configs.push({
      type: "discord",
      url: process.env.DISCORD_WEBHOOK_URL,
      events: parseEvents(process.env.DISCORD_WEBHOOK_EVENTS),
      enabled: true,
    });
  }

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    configs.push({
      type: "telegram",
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      events: parseEvents(process.env.TELEGRAM_WEBHOOK_EVENTS),
      enabled: true,
    });
  }

  if (process.env.GENERIC_WEBHOOK_URL) {
    configs.push({
      type: "generic",
      url: process.env.GENERIC_WEBHOOK_URL,
      events: parseEvents(process.env.GENERIC_WEBHOOK_EVENTS),
      enabled: true,
    });
  }

  return configs;
}

function parseEvents(envValue: string | undefined): import("./types").NotificationEvent[] {
  if (!envValue || envValue === "*") {
    return ["ticket.created", "ticket.resolved", "ticket.closed", "device.warranty_expiring", "software.license_expiring", "user.locked"];
  }
  return envValue.split(",").map((e) => e.trim()) as import("./types").NotificationEvent[];
}
