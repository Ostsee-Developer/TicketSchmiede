import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const INTERNAL_TICKET_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.INTERNAL_ADMIN,
  Role.TECHNICIAN,
  Role.CUSTOMER_ADMIN,
];

export async function getTicketCreatedRecipients(tenantId: string, excludeUserId?: string) {
  const [tenantUsers, superAdmins] = await Promise.all([
    prisma.userTenantRole.findMany({
      where: {
        tenantId,
        role: { in: INTERNAL_TICKET_ROLES },
        user: { isActive: true },
      },
      select: { user: { select: { id: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { isSuperAdmin: true, isActive: true },
      select: { id: true, email: true },
    }),
  ]);

  return uniqueEmails([
    ...tenantUsers.map((item) => item.user),
    ...superAdmins,
  ], excludeUserId);
}

export async function getTicketCommentRecipients(ticketId: string, isInternal: boolean, excludeUserId?: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      tenantId: true,
      createdBy: { select: { id: true, email: true, isActive: true } },
      technician: { select: { id: true, email: true, isActive: true } },
      comments: {
        where: isInternal ? { isInternal: true } : {},
        select: { user: { select: { id: true, email: true, isActive: true } } },
      },
    },
  });
  if (!ticket) return [];

  const internalRecipients = await getTicketCreatedRecipients(ticket.tenantId, excludeUserId);
  const users = [
    !isInternal ? ticket.createdBy : null,
    ticket.technician,
    ...ticket.comments.map((comment) => comment.user),
  ].filter(Boolean) as { id: string; email: string; isActive?: boolean }[];

  return Array.from(new Set([...uniqueEmails(users, excludeUserId), ...internalRecipients]));
}

function uniqueEmails(users: { id: string; email: string; isActive?: boolean }[], excludeUserId?: string) {
  return Array.from(
    new Set(
      users
        .filter((user) => user.id !== excludeUserId && user.isActive !== false)
        .map((user) => user.email)
        .filter(Boolean)
    )
  );
}
