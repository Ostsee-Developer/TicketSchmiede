export type NotificationEvent =
  | "ticket.created"
  | "ticket.updated"
  | "ticket.resolved"
  | "ticket.closed"
  | "ticket.comment"
  | "device.warranty_expiring"
  | "software.license_expiring"
  | "user.locked";

export interface NotificationPayload {
  event: NotificationEvent;
  tenantId?: string;
  tenantName?: string;
  recipients?: string[];
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookConfig {
  type: "discord" | "telegram" | "email" | "generic";
  url?: string;           // Discord/Telegram/Generic webhook URL
  chatId?: string;        // Telegram chat ID
  botToken?: string;      // Telegram bot token
  email?: string;         // Email recipient
  events: NotificationEvent[];
  enabled: boolean;
}
