import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { ok, unauthorized, forbidden, notFound, serverError, handleZodError, noContent } from "@/lib/api";

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  street: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) return unauthorized();

    const ctx = await resolveTenantContext(id);
    if (!ctx) return forbidden();

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        locations: true,
        _count: {
          select: {
            employees: true,
            devices: true,
            workstations: true,
            tickets: true,
            software: true,
            credentials: true,
          },
        },
      },
    });

    if (!tenant) return notFound();
    return ok(tenant);
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
    const session = await auth();
    if (!session?.user) return unauthorized();

    if (!session.user.isSuperAdmin) return forbidden();

    const body = await request.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ipAddress, userAgent } = getClientInfo(request);

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) return notFound();

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        website: parsed.data.website || null,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: id,
      action: "UPDATE",
      resource: "Tenant",
      resourceId: id,
      details: { changes: Object.keys(parsed.data) },
      ipAddress,
      userAgent,
    });

    return ok(tenant);
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
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!session.user.isSuperAdmin) return forbidden();

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    const { ipAddress, userAgent } = getClientInfo(request);

    const existing = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true, tickets: true, devices: true },
        },
      },
    });
    if (!existing) return notFound();

    // Safety check: prevent accidental deletion of tenants with data
    const hasData = existing._count.employees > 0 || existing._count.tickets > 0 || existing._count.devices > 0;
    if (hasData && !force) {
      return NextResponse.json(
        {
          success: false,
          error: "Mandant enthält Daten. Zum erzwungenen Löschen ?force=true verwenden.",
          counts: existing._count,
        },
        { status: 409 }
      );
    }

    // Soft delete: set deletedAt and deactivate
    await prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "DELETE",
      resource: "Tenant",
      resourceId: id,
      details: { name: existing.name, forced: force, counts: existing._count },
      ipAddress,
      userAgent,
    });

    return noContent();
  } catch (error) {
    return serverError(error);
  }
}
