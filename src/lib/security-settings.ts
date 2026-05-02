import { prisma } from "./prisma";

export type LoginPolicy = "PASSWORD_AND_PASSKEY" | "PASSWORD_ONLY" | "PASSKEY_ONLY";

export const DEFAULT_LOGIN_POLICY: LoginPolicy = "PASSWORD_AND_PASSKEY";
const LOGIN_POLICY_KEY = "loginPolicy";

export function normalizeLoginPolicy(value: unknown): LoginPolicy {
  if (
    value === "PASSWORD_AND_PASSKEY" ||
    value === "PASSWORD_ONLY" ||
    value === "PASSKEY_ONLY"
  ) {
    return value;
  }
  return DEFAULT_LOGIN_POLICY;
}

export function passwordLoginAllowed(policy: LoginPolicy): boolean {
  return policy === "PASSWORD_AND_PASSKEY" || policy === "PASSWORD_ONLY";
}

export function passkeyLoginAllowed(policy: LoginPolicy): boolean {
  return policy === "PASSWORD_AND_PASSKEY" || policy === "PASSKEY_ONLY";
}

export async function getLoginPolicy(): Promise<LoginPolicy> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: LOGIN_POLICY_KEY },
    select: { value: true },
  });

  return normalizeLoginPolicy(setting?.value);
}

export async function setLoginPolicy(policy: LoginPolicy): Promise<LoginPolicy> {
  const normalized = normalizeLoginPolicy(policy);
  await prisma.systemSetting.upsert({
    where: { key: LOGIN_POLICY_KEY },
    create: { key: LOGIN_POLICY_KEY, value: normalized },
    update: { value: normalized },
  });
  return normalized;
}
