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
  templateId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  category: z.string().optional().nullable(),
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
        templateId: true,
        name: true,
        username: true,
        url: true,
        category: true,
        expiresAt: true,
        lastRotatedAt: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        template: { select: { id: true, name: true, category: true } },
      },
    });
    if (!credential) return notFound();

    const ctx = await resolveTenantContext(credential.tenantId);
    if (!ctx) return unauthorized();
    if (!can.viewCredentials(ctx.role)) return forbidden();

    return ok(credential);
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

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.password !== undefined) {
      updateData.encryptedPassword = parsed.data.password ? encrypt(parsed.data.password) : null;
      updateData.lastRotatedAt = new Date();
      delete updateData.password;
    }
    if (parsed.data.notes !== undefined) {
      updateData.encryptedNotes = parsed.data.notes ? encrypt(parsed.data.notes) : null;
      delete updateData.notes;
    }
    if (parsed.data.url === "") updateData.url = null;

    const updated = await prisma.credential.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "UPDATE",
      resource: "Credential",
      resourceId: id,
      details: { name: credential.name, changes: Object.keys(parsed.data).filter((k) => k !== "password" && k !== "notes") },
      ipAddress,
      userAgent,
    });

    return ok({ id: updated.id, name: updated.name });
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
      action: "DELETE",
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
