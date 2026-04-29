import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal-context";
import { prisma } from "@/lib/prisma";
import { NewTicketWizard } from "@/components/portal/new-ticket-wizard";

export const metadata = { title: "Neues Ticket – TicketSchmiede" };

export default async function NewPortalTicketPage() {
  const ctx = await getPortalContext();
  if (!ctx) redirect("/login");

  const employees = await prisma.employee.findMany({
    where: { tenantId: ctx.tenantId, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <NewTicketWizard
      tenantId={ctx.tenantId}
      employees={employees}
    />
  );
}
