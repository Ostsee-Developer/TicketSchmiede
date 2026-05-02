import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface AppBrandingSettings {
  appName: string;
  loginSubtitle: string;
  loginHeadline: string;
  loginHighlight: string;
  loginDescription: string;
  loginFooter: string;
}

export const DEFAULT_APP_BRANDING: AppBrandingSettings = {
  appName: "Ticket Schmiede",
  loginSubtitle: "IT-Dokumentation & Ticketsystem",
  loginHeadline: "IT-Dokumentation",
  loginHighlight: "neu gedacht.",
  loginDescription:
    "Mandantenfähig, sicher und einfach zu bedienen. Verwalte Tickets, Geräte und Zugangsdaten an einem Ort.",
  loginFooter: "IT Service - Sven Weigle · Alle Rechte vorbehalten",
};

const APP_BRANDING_KEY = "appBranding";

export function normalizeAppBranding(value: unknown): AppBrandingSettings {
  if (!value || typeof value !== "object") return DEFAULT_APP_BRANDING;
  const data = value as Partial<Record<keyof AppBrandingSettings, unknown>>;
  return {
    appName: stringOrDefault(data.appName, DEFAULT_APP_BRANDING.appName),
    loginSubtitle: stringOrDefault(data.loginSubtitle, DEFAULT_APP_BRANDING.loginSubtitle),
    loginHeadline: stringOrDefault(data.loginHeadline, DEFAULT_APP_BRANDING.loginHeadline),
    loginHighlight: stringOrDefault(data.loginHighlight, DEFAULT_APP_BRANDING.loginHighlight),
    loginDescription: stringOrDefault(data.loginDescription, DEFAULT_APP_BRANDING.loginDescription),
    loginFooter: stringOrDefault(data.loginFooter, DEFAULT_APP_BRANDING.loginFooter),
  };
}

export async function getAppBranding(): Promise<AppBrandingSettings> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: APP_BRANDING_KEY },
    select: { value: true },
  });
  return normalizeAppBranding(setting?.value);
}

export async function setAppBranding(settings: AppBrandingSettings): Promise<AppBrandingSettings> {
  const normalized = normalizeAppBranding(settings);
  const value = normalized as unknown as Prisma.InputJsonObject;
  await prisma.systemSetting.upsert({
    where: { key: APP_BRANDING_KEY },
    create: { key: APP_BRANDING_KEY, value },
    update: { value },
  });
  return normalized;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
