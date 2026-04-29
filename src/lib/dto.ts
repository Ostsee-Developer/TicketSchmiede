/**
 * DTO / Serializer layer
 *
 * Strip sensitive fields from DB records before sending them to the client.
 * All serializers are pure functions — no DB calls, no side-effects.
 * Call them immediately before `ok()` / `created()`.
 */

import { Role } from "@prisma/client";
import { hasMinRole } from "./permissions";

// ─── Software ────────────────────────────────────────────────────────────────

type WithLicenseKey<T> = T & { licenseKey?: string | null };
type WithoutLicenseKey<T> = Omit<T, "licenseKey">;

/**
 * Remove licenseKey for roles below INTERNAL_ADMIN.
 * TECHNICIAN and below must not see software license keys.
 */
export function serializeSoftware<T extends WithLicenseKey<object>>(
  software: T,
  role: Role
): T | WithoutLicenseKey<T> {
  if (hasMinRole(role, Role.INTERNAL_ADMIN)) return software;
  const { licenseKey: _lk, ...safe } = software;
  return safe as WithoutLicenseKey<T>;
}

// ─── Credentials ─────────────────────────────────────────────────────────────

type RawCredential = {
  encryptedPassword?: string | null;
  encryptedNotes?: string | null;
  encryptedRustdeskPassword?: string | null;
  encryptedTeamviewerPassword?: string | null;
  [key: string]: unknown;
};

type SafeCredential<T extends RawCredential> = Omit<
  T,
  | "encryptedPassword"
  | "encryptedNotes"
  | "encryptedRustdeskPassword"
  | "encryptedTeamviewerPassword"
> & {
  hasPassword: boolean;
  hasNotes: boolean;
  hasRustdeskPassword: boolean;
  hasTeamviewerPassword: boolean;
};

/**
 * Replace all encrypted credential fields with boolean "has…" flags.
 * Encrypted ciphertext must never leave the server — only the /reveal
 * endpoint (INTERNAL_ADMIN+) returns the decrypted values.
 */
export function serializeCredential<T extends RawCredential>(
  credential: T
): SafeCredential<T> {
  const {
    encryptedPassword,
    encryptedNotes,
    encryptedRustdeskPassword,
    encryptedTeamviewerPassword,
    ...rest
  } = credential;

  return {
    ...rest,
    hasPassword: !!encryptedPassword,
    hasNotes: !!encryptedNotes,
    hasRustdeskPassword: !!encryptedRustdeskPassword,
    hasTeamviewerPassword: !!encryptedTeamviewerPassword,
  } as SafeCredential<T>;
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

type WithInternalNotes<T> = T & { internalNotes?: string | null };

/**
 * Remove internalNotes for customer roles.
 * Only TECHNICIAN+ may read internal ticket notes.
 */
export function serializeTicket<T extends WithInternalNotes<object>>(
  ticket: T,
  role: Role
): T | Omit<T, "internalNotes"> {
  if (hasMinRole(role, Role.TECHNICIAN)) return ticket;
  const { internalNotes: _in, ...safe } = ticket;
  return safe as Omit<T, "internalNotes">;
}
