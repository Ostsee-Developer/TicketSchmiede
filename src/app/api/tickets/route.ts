import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { isCustomerRole } from "@/lib/permissions";
import { ok, created, unauthorized, forbidden, serverError, handleZodError, getPagination } from "@/lib/api";
import { auth } from "@/lib/auth";
import { dispatchNotification } from "@/lib/notifications/dispatcher";

const createTicketSchema = z.object({
  tenantId: z.string().cuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  category: z.enum(["HARDWARE", "SOFTWARE", "EMAIL", "NETWORK", "USER_ACCOUNT", "PRINTER", "PHONE", "VPN", "OTHER"]).default("OTHER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  employeeId: z.string().cuid().optional().nullable(),
  workstationId: z.string().cuid().optional().nullable(),
  deviceId: z.string().cuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return forbidden("tenantId erforderlich");

    const ctx = await resolveTenantContext(tenantId);
    if (!ctx) return unauthorized();

    const { skip, limit, page } = getPagination(url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const search = url.searchParams.get("search") ?? "";

    const isCustomer = isCustomerRole(ctx.role);

    const where = {
      tenantId,
      // Customers can only see their own tickets (by the user who created them)
      ...(isCustomer ? { createdById: ctx.userId } : {}),
      ...(status ? { status: status as "NEW" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED" | "CLOSED" } : {}),
      ...(priority ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          technician: isCustomer ? undefined : { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const ctx = await resolveTenantContext(parsed.data.tenantId);
    if (!ctx) return unauthorized();

    const { ipAddress, userAgent } = getClientInfo(request);

    // Get next ticket number
    const counter = await prisma.ticketCounter.upsert({
      where: { tenantId: parsed.data.tenantId },
      update: { lastNumber: { increment: 1 } },
      create: { tenantId: parsed.data.tenantId, lastNumber: 1 },
    });

    const ticket = await prisma.ticket.create({
      data: {
        ...parsed.data,
        number: counter.lastNumber,
        createdById: ctx.userId,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "CREATE",
      resource: "Ticket",
      resourceId: ticket.id,
      details: { number: ticket.number, title: ticket.title },
      ipAddress,
      userAgent,
    });

    // Fire-and-forget notification
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
    dispatchNotification({
      event: "ticket.created",
      tenantId: ctx.tenantId,
      tenantName: tenant?.name,
      data: {
        number: ticket.number,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return created(ticket);
  } catch (error) {
    return serverError(error);
  }
}
