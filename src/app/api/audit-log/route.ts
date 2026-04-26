import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { ok, unauthorized, forbidden, serverError, getPagination } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const action = url.searchParams.get("action");
    const resource = url.searchParams.get("resource");
    const { skip, limit, page } = getPagination(url);

    if (tenantId) {
      const ctx = await resolveTenantContext(tenantId);
      if (!ctx) return unauthorized();
      if (!can.viewAuditLog(ctx.role)) return forbidden();
    } else if (!session.user.isSuperAdmin) {
      return forbidden();
    }

    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(action ? { action: action as "LOGIN" } : {}),
      ...(resource ? { resource } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return serverError(error);
  }
}
