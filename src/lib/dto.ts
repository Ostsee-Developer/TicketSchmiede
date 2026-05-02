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
