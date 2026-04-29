import { Role } from "@prisma/client";
import { resolveTenantContext, TenantContext } from "./tenant";
import { hasMinRole } from "./permissions";
import { unauthorized, forbidden } from "./api";

type GuardOk = { ctx: TenantContext; error: null };
type GuardErr = { ctx: null; error: Response };

/**
 * Resolve tenant context and optionally enforce a minimum role in one step.
 *
 * Usage in API routes:
 *   const { ctx, error } = await guardTenant(tenantId, Role.TECHNICIAN);
 *   if (error) return error;
 *
 * Returns the resolved TenantContext on success, or a ready-to-return
 * 401/403 Response on failure — no additional checks required at call site.
 */
export async function guardTenant(
  tenantId: string,
  minRole?: Role
): Promise<GuardOk | GuardErr> {
  const ctx = await resolveTenantContext(tenantId);
  if (!ctx) return { ctx: null, error: unauthorized() };
  if (minRole && !hasMinRole(ctx.role, minRole)) {
    return { ctx: null, error: forbidden() };
  }
  return { ctx, error: null };
}
