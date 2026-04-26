import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { decrypt } from "@/lib/encryption";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api";

/**
 * POST /api/credentials/[id]/reveal
 * Returns the decrypted password for a credential.
 * Requires TECHNICIAN role or higher.
 * Every reveal is logged in the audit log.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const credential = await prisma.credential.findUnique({ where: { id } });
    if (!credential) return notFound();

    const ctx = await resolveTenantContext(credential.tenantId);
    if (!ctx) return unauthorized();
    if (!can.revealCredentials(ctx.role)) return forbidden("Keine Berechtigung zum Anzeigen von Passwörtern");

    const { ipAddress, userAgent } = getClientInfo(request);

    // Log EVERY password reveal
    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREDENTIAL_VIEW",
      resource: "Credential",
      resourceId: id,
      details: {
        credentialName: credential.name,
        employeeId: credential.employeeId,
      },
      ipAddress,
      userAgent,
    });

    const password = credential.encryptedPassword
      ? decrypt(credential.encryptedPassword)
      : null;

    const notes = credential.encryptedNotes
      ? decrypt(credential.encryptedNotes)
      : null;

    return ok({ password, notes });
  } catch (error) {
    return serverError(error);
  }
}
