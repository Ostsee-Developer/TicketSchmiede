import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { isCustomerRole } from "@/lib/permissions";
import { created, unauthorized, forbidden, notFound, serverError, handleZodError } from "@/lib/api";

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
  timeSpent: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return notFound();

    const ctx = await resolveTenantContext(ticket.tenantId);
    if (!ctx) return unauthorized();

    // Customers can only comment on their own tickets, and cannot post internal notes
    if (isCustomerRole(ctx.role)) {
      if (ticket.createdById !== ctx.userId) return forbidden();
    }

    const body = await request.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    // Customers cannot post internal comments
    const isInternal = isCustomerRole(ctx.role) ? false : parsed.data.isInternal;

    const { ipAddress, userAgent } = getClientInfo(request);

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        userId: ctx.userId,
        content: parsed.data.content,
        isInternal,
        timeSpent: parsed.data.timeSpent,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // If timeSpent provided, add to ticket total
    if (parsed.data.timeSpent && !isCustomerRole(ctx.role)) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { timeSpent: { increment: parsed.data.timeSpent } },
      });
    }

    await createAuditLog({
      userId: ctx.userId,
      tenantId: ticket.tenantId,
      action: "UPDATE",
      resource: "Ticket",
      resourceId: ticketId,
      details: { action: "comment_added", isInternal, ticketNumber: ticket.number },
      ipAddress,
      userAgent,
    });

    return created(comment);
  } catch (error) {
    return serverError(error);
  }
}
