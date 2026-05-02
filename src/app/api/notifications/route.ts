import { Prisma, TicketStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { ok, serverError, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const openStatuses: TicketStatus[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_CUSTOMER"];

    const tenantRoles = await prisma.userTenantRole.findMany({
      where: { userId: session.user.id },
      select: { tenantId: true, role: true },
    });
    const tenantIds = tenantRoles.map((role) => role.tenantId);

    const where: Prisma.TicketWhereInput = session.user.isSuperAdmin
      ? { status: { in: openStatuses } }
      : {
          status: { in: openStatuses },
          OR: [
            { technicianId: session.user.id },
            { createdById: session.user.id },
            ...(tenantIds.length ? [{ tenantId: { in: tenantIds } }] : []),
          ],
        };

    const [openTickets, recentTickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          tenantId: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
          tenant: { select: { name: true } },
        },
      }),
    ]);

    return ok({ openTickets, recentTickets });
  } catch (error) {
    return serverError(error);
  }
}
