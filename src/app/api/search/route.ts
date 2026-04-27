import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api";
import { resolveTenantContext } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const tenantId = url.searchParams.get("tenantId") ?? "";

    if (q.length < 2) return badRequest("Suchbegriff muss mindestens 2 Zeichen haben");
    if (!tenantId) return badRequest("tenantId erforderlich");

    const ctx = await resolveTenantContext(tenantId);
    if (!ctx) return unauthorized();

    const contains = { contains: q, mode: "insensitive" as const };

    const [employees, devices, tickets] = await Promise.all([
      prisma.employee.findMany({
        where: {
          tenantId,
          status: { not: "LEFT" },
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
            { department: contains },
            { position: contains },
          ],
        },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          department: true,
          status: true,
        },
      }),
      prisma.device.findMany({
        where: {
          tenantId,
          OR: [
            { manufacturer: contains },
            { model: contains },
            { hostname: contains },
            { serialNumber: contains },
            { inventoryNumber: contains },
          ],
        },
        take: 5,
        select: {
          id: true,
          type: true,
          manufacturer: true,
          model: true,
          hostname: true,
          status: true,
        },
      }),
      prisma.ticket.findMany({
        where: {
          tenantId,
          OR: [
            { title: contains },
            { description: contains },
          ],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      }),
    ]);

    return ok({ employees, devices, tickets, query: q });
  } catch (error) {
    return serverError(error);
  }
}
