import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { createAuditLog, getClientInfo } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { decrypt } from "@/lib/encryption";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const includePasswords = url.searchParams.get("includePasswords") === "true";

    if (!tenantId) return forbidden("tenantId erforderlich");

    const ctx = await resolveTenantContext(tenantId);
    if (!ctx) return unauthorized();
    if (!can.exportWithoutPasswords(ctx.role)) return forbidden();

    if (includePasswords && !can.exportWithPasswords(ctx.role)) {
      return forbidden("Keine Berechtigung für Export mit Passwörtern");
    }

    const { ipAddress, userAgent } = getClientInfo(request);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return notFound();

    // Fetch all data
    const [employees, workstations, devices, software, credentials] = await Promise.all([
      prisma.employee.findMany({
        where: { tenantId },
        include: { location: true },
        orderBy: { lastName: "asc" },
      }),
      prisma.workstation.findMany({
        where: { tenantId },
        include: { location: true, employee: true },
        orderBy: { name: "asc" },
      }),
      prisma.device.findMany({
        where: { tenantId },
        include: { location: true, employee: true },
        orderBy: { type: "asc" },
      }),
      prisma.software.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
      }),
      prisma.credential.findMany({
        where: { tenantId },
        include: { employee: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ticket Schmiede";
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } },
      border: {
        bottom: { style: "medium", color: { argb: "FF1E40AF" } },
      },
    };

    const addSheet = (
      name: string,
      columns: { header: string; key: string; width?: number }[],
      rows: Record<string, unknown>[]
    ) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map((c) => ({ ...c, width: c.width ?? 20 }));
      sheet.getRow(1).eachCell((cell) => {
        Object.assign(cell, headerStyle);
      });
      sheet.addRows(rows);
      sheet.getRow(1).height = 22;
      return sheet;
    };

    // Sheet: Mitarbeiter
    addSheet(
      "Mitarbeiter",
      [
        { header: "Externe ID", key: "externalRef", width: 15 },
        { header: "Nachname", key: "lastName", width: 20 },
        { header: "Vorname", key: "firstName", width: 20 },
        { header: "E-Mail", key: "email", width: 30 },
        { header: "Telefon", key: "phone", width: 18 },
        { header: "Mobil", key: "mobile", width: 18 },
        { header: "Position", key: "position", width: 25 },
        { header: "Abteilung", key: "department", width: 20 },
        { header: "Standort", key: "locationName", width: 20 },
        { header: "Status", key: "status", width: 12 },
        { header: "Eintrittsdatum", key: "startDate", width: 16 },
        { header: "Austrittsdatum", key: "endDate", width: 16 },
        { header: "Notizen", key: "notes", width: 40 },
      ],
      employees.map((e) => ({
        ...e,
        locationName: e.location?.name ?? "",
        startDate: e.startDate?.toISOString().split("T")[0] ?? "",
        endDate: e.endDate?.toISOString().split("T")[0] ?? "",
      }))
    );

    // Sheet: Arbeitsplätze
    addSheet(
      "Arbeitsplaetze",
      [
        { header: "Externe ID", key: "externalRef", width: 15 },
        { header: "Name", key: "name", width: 20 },
        { header: "Raum", key: "room", width: 15 },
        { header: "Standort", key: "locationName", width: 20 },
        { header: "Mitarbeiter", key: "employeeName", width: 25 },
        { header: "Netzwerkdose", key: "networkOutlet", width: 15 },
        { header: "IP-Adresse", key: "ipAddress", width: 15 },
        { header: "Notizen", key: "notes", width: 40 },
      ],
      workstations.map((w) => ({
        ...w,
        locationName: w.location?.name ?? "",
        employeeName: w.employee
          ? `${w.employee.lastName}, ${w.employee.firstName}`
          : "",
      }))
    );

    // Sheet: Geräte
    addSheet(
      "Geraete",
      [
        { header: "Externe ID", key: "externalRef", width: 15 },
        { header: "Typ", key: "type", width: 15 },
        { header: "Hersteller", key: "manufacturer", width: 18 },
        { header: "Modell", key: "model", width: 25 },
        { header: "Seriennummer", key: "serialNumber", width: 20 },
        { header: "Inventarnummer", key: "inventoryNumber", width: 18 },
        { header: "OS", key: "os", width: 15 },
        { header: "IP-Adresse", key: "ipAddress", width: 15 },
        { header: "MAC-Adresse", key: "macAddress", width: 18 },
        { header: "Hostname", key: "hostname", width: 20 },
        { header: "Kaufdatum", key: "purchaseDate", width: 14 },
        { header: "Garantie bis", key: "warrantyUntil", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Mitarbeiter", key: "employeeName", width: 25 },
        { header: "Standort", key: "locationName", width: 20 },
        { header: "Notizen", key: "notes", width: 40 },
      ],
      devices.map((d) => ({
        ...d,
        purchaseDate: d.purchaseDate?.toISOString().split("T")[0] ?? "",
        warrantyUntil: d.warrantyUntil?.toISOString().split("T")[0] ?? "",
        employeeName: d.employee
          ? `${d.employee.lastName}, ${d.employee.firstName}`
          : "",
        locationName: d.location?.name ?? "",
      }))
    );

    // Sheet: Software
    addSheet(
      "Software",
      [
        { header: "Externe ID", key: "externalRef", width: 15 },
        { header: "Name", key: "name", width: 30 },
        { header: "Hersteller", key: "vendor", width: 20 },
        { header: "Version", key: "version", width: 12 },
        { header: "Lizenztyp", key: "licenseType", width: 15 },
        { header: "Lizenzanzahl", key: "licenseCount", width: 14 },
        { header: "Gültig bis", key: "validUntil", width: 14 },
        { header: "Kostenstelle", key: "costCenter", width: 15 },
        { header: "Notizen", key: "notes", width: 40 },
      ],
      software.map((s) => ({
        ...s,
        validUntil: s.validUntil?.toISOString().split("T")[0] ?? "",
        licenseKey: undefined, // Never export license keys in default export
      }))
    );

    // Sheet: Zugangsdaten
    addSheet(
      "Zugangsdaten",
      [
        { header: "Externe ID", key: "externalRef", width: 15 },
        { header: "Name", key: "name", width: 30 },
        { header: "Kategorie", key: "category", width: 20 },
        { header: "Benutzername", key: "username", width: 30 },
        ...(includePasswords
          ? [{ header: "Passwort", key: "password", width: 30 }]
          : []),
        { header: "URL", key: "url", width: 30 },
        { header: "Mitarbeiter", key: "employeeName", width: 25 },
        { header: "Ablaufdatum", key: "expiresAt", width: 14 },
      ],
      credentials.map((c) => ({
        ...c,
        password: includePasswords && c.encryptedPassword
          ? (() => { try { return decrypt(c.encryptedPassword!); } catch { return ""; } })()
          : undefined,
        employeeName: c.employee
          ? `${c.employee.lastName}, ${c.employee.firstName}`
          : "",
        expiresAt: c.expiresAt?.toISOString().split("T")[0] ?? "",
      }))
    );

    // Audit log
    await createAuditLog({
      userId: ctx.userId,
      tenantId,
      action: "EXPORT",
      resource: "Tenant",
      resourceId: tenantId,
      details: {
        type: "excel",
        includePasswords,
        counts: {
          employees: employees.length,
          devices: devices.length,
          software: software.length,
        },
      },
      ipAddress,
      userAgent,
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ticketschmiede_${tenant.slug}_${new Date().toISOString().split("T")[0]}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
