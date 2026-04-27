import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { encrypt } from "@/lib/encryption";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError, noContent } from "@/lib/api";

const updateSchema = z.object({
  employeeId: z.string().cuid().optional().nullable(),
  deviceId: z.string().cuid().optional().nullable(),
  templateId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  category: z.string().optional().nullable(),
  rustdeskId: z.string().optional().nullable(),
  rustdeskPassword: z.string().optional().nullable(),
  teamviewerId: z.string().optional().nullable(),
  teamviewerPassword: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const credential = await prisma.credential.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        deviceId: true,
        templateId: true,
        name: true,
        username: true,
        url: true,
        category: true,
        rustdeskId: true,
        teamviewerId: true,
        expiresAt: true,
        lastRotatedAt: true,
        externalRef: true,
        createdAt: true,
        updatedAt: true,
        encryptedPassword: true,
        encryptedRustdeskPassword: true,
        encryptedTeamviewerPassword: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        device: { select: { id: true, type: true, manufacturer: true, model: true } },
        template: { select: { id: true, name: true } },
      },
    });
    if (!credential) return notFound();

    const ctx = await resolveTenantContext(credential.tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewCredentials(ctx.role)) return forbidden();

    const { encryptedPassword, encryptedRustdeskPassword, encryptedTeamviewerPassword, ...rest } = credential;
    return ok({
      ...rest,
      hasPassword: !!encryptedPassword,
      hasRustdeskPassword: !!encryptedRustdeskPassword,
      hasTeamviewerPassword: !!encryptedTeamviewerPassword,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const credential = await prisma.credential.findUnique({ where: { id } });
    if (!credential) return notFound();

    const ctx = await resolveTenantContext(credential.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageCredentials(ctx.role)) return forbidden();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);
    const { password, notes, rustdeskPassword, teamviewerPassword, ...rest } = parsed.data;

    const updated = await prisma.credential.update({
      where: { id },
      data: {
        ...rest,
        url: rest.url || null,
        ...(password !== undefined
          ? { encryptedPassword: password ? encrypt(password) : null, lastRotatedAt: password ? new Date() : credential.lastRotatedAt }
          : {}),
        ...(notes !== undefined ? { encryptedNotes: notes ? encrypt(notes) : null } : {}),
        ...(rustdeskPassword !== undefined
          ? { encryptedRustdeskPassword: rustdeskPassword ? encrypt(rustdeskPassword) : null }
          : {}),
        ...(teamviewerPassword !== undefined
          ? { encryptedTeamviewerPassword: teamviewerPassword ? encrypt(teamviewerPassword) : null }
          : {}),
        expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : rest.expiresAt,
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREDENTIAL_UPDATE",
      resource: "Credential",
      resourceId: id,
      details: { name: updated.name, changed: Object.keys(parsed.data) },
      ipAddress,
      userAgent,
    });

    const { encryptedPassword: _ep, encryptedNotes: _en, encryptedRustdeskPassword: _er, encryptedTeamviewerPassword: _et, ...safeData } = updated;
    return ok({ ...safeData, hasPassword: !!_ep, hasRustdeskPassword: !!_er, hasTeamviewerPassword: !!_et });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const credential = await prisma.credential.findUnique({ where: { id } });
    if (!credential) return notFound();

    const ctx = await resolveTenantContext(credential.tenantId);
    if (!ctx) return unauthorized();
    if (!can.manageCredentials(ctx.role)) return forbidden();

    const { ipAddress, userAgent } = getClientInfo(request);

    await prisma.credential.delete({ where: { id } });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREDENTIAL_DELETE",
      resource: "Credential",
      resourceId: id,
      details: { name: credential.name },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
