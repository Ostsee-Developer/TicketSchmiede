import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { decrypt } from "@/lib/encryption";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api";
import { auth } from "@/lib/auth";

/**
 * POST /api/credentials/[id]/reveal
 *
 * Returns decrypted password + notes for a credential.
 * Requires INTERNAL_ADMIN or higher — TECHNICIAN is explicitly excluded.
 * Every call is permanently logged in the audit log.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    const credential = await prisma.credential.findUnique({ where: { id } });
    if (!credential) return notFound();

    const ctx = await resolveTenantContext(credential.tenantId);
    if (!ctx) return unauthorized();

    // INTERNAL_ADMIN+ only — Technicians must not see decrypted passwords
    if (!can.revealCredentials(ctx.role)) {
      return forbidden("Keine Berechtigung zum Anzeigen von Passwörtern");
    }

    const { ipAddress, userAgent } = getClientInfo(request);

    await createAuditLog({
      userId: ctx.userId,
      userEmail: session.user.email,
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

    const rustdeskPassword = credential.encryptedRustdeskPassword
      ? decrypt(credential.encryptedRustdeskPassword)
      : null;

    const teamviewerPassword = credential.encryptedTeamviewerPassword
      ? decrypt(credential.encryptedTeamviewerPassword)
      : null;

    return ok({ password, notes, rustdeskPassword, teamviewerPassword });
  } catch (error) {
    return serverError(error);
  }
}
