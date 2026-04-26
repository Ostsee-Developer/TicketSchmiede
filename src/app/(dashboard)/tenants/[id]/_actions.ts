"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant";
import { can, type Role } from "@/lib/permissions";
import { encrypt } from "@/lib/encryption";

type PermissionCheck = (role: Role) => boolean;

function value(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredValue(formData: FormData, key: string, label: string): string {
  const v = value(formData, key);
  if (!v) throw new Error(`${label} ist erforderlich`);
  return v;
}

function dateValue(formData: FormData, key: string): Date | null {
  const v = value(formData, key);
  return v ? new Date(`${v}T00:00:00.000Z`) : null;
}

function intValue(formData: FormData, key: string): number | null {
  const v = value(formData, key);
  return v ? Number.parseInt(v, 10) : null;
}

function decimalValue(formData: FormData, key: string): string | null {
  const v = value(formData, key);
  return v ? v.replace(",", ".") : null;
}

async function requireTenant(tenantId: string, check: PermissionCheck) {
  const ctx = await resolveTenantContext(tenantId);
  if (!ctx) {
    redirect("/dashboard");
  }
  if (!ctx) throw new Error("Nicht authentifiziert");
  if (!check(ctx.role)) {
    redirect(`/tenants/${tenantId}/dashboard`);
  }
  return ctx;
}

export async function createEmployee(tenantId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageEmployees);
  const employee = await prisma.employee.create({
    data: {
      tenantId,
      locationId: value(formData, "locationId"),
      firstName: requiredValue(formData, "firstName", "Vorname"),
      lastName: requiredValue(formData, "lastName", "Nachname"),
      email: value(formData, "email"),
      phone: value(formData, "phone"),
      mobile: value(formData, "mobile"),
      position: value(formData, "position"),
      department: value(formData, "department"),
      status: (value(formData, "status") ?? "ACTIVE") as "ACTIVE" | "DISABLED" | "LEFT",
      startDate: dateValue(formData, "startDate"),
      endDate: dateValue(formData, "endDate"),
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/employees`);
  redirect(`/tenants/${tenantId}/employees/${employee.id}`);
}

export async function updateEmployee(tenantId: string, employeeId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageEmployees);
  await prisma.employee.updateMany({
    where: { id: employeeId, tenantId },
    data: {
      locationId: value(formData, "locationId"),
      firstName: requiredValue(formData, "firstName", "Vorname"),
      lastName: requiredValue(formData, "lastName", "Nachname"),
      email: value(formData, "email"),
      phone: value(formData, "phone"),
      mobile: value(formData, "mobile"),
      position: value(formData, "position"),
      department: value(formData, "department"),
      status: (value(formData, "status") ?? "ACTIVE") as "ACTIVE" | "DISABLED" | "LEFT",
      startDate: dateValue(formData, "startDate"),
      endDate: dateValue(formData, "endDate"),
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/employees`);
  revalidatePath(`/tenants/${tenantId}/employees/${employeeId}`);
  redirect(`/tenants/${tenantId}/employees/${employeeId}`);
}

export async function deleteEmployee(tenantId: string, employeeId: string) {
  await requireTenant(tenantId, can.manageEmployees);
  await prisma.employee.deleteMany({ where: { id: employeeId, tenantId } });
  revalidatePath(`/tenants/${tenantId}/employees`);
  redirect(`/tenants/${tenantId}/employees`);
}

export async function createDevice(tenantId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageDevices);
  const device = await prisma.device.create({
    data: {
      tenantId,
      locationId: value(formData, "locationId"),
      employeeId: value(formData, "employeeId"),
      workstationId: value(formData, "workstationId"),
      type: (value(formData, "type") ?? "OTHER") as "LAPTOP" | "PC" | "SERVER" | "PRINTER" | "FIREWALL" | "SWITCH" | "ROUTER" | "SMARTPHONE" | "TABLET" | "MONITOR" | "DOCKING_STATION" | "NAS" | "ACCESS_POINT" | "UPS" | "OTHER",
      manufacturer: value(formData, "manufacturer"),
      model: value(formData, "model"),
      serialNumber: value(formData, "serialNumber"),
      inventoryNumber: value(formData, "inventoryNumber"),
      purchaseDate: dateValue(formData, "purchaseDate"),
      warrantyUntil: dateValue(formData, "warrantyUntil"),
      os: value(formData, "os"),
      osVersion: value(formData, "osVersion"),
      ipAddress: value(formData, "ipAddress"),
      macAddress: value(formData, "macAddress"),
      hostname: value(formData, "hostname"),
      status: (value(formData, "status") ?? "ACTIVE") as "ACTIVE" | "IN_STORAGE" | "IN_REPAIR" | "DECOMMISSIONED" | "LOST",
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/devices`);
  redirect(`/tenants/${tenantId}/devices/${device.id}`);
}

export async function updateDevice(tenantId: string, deviceId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageDevices);
  await prisma.device.updateMany({
    where: { id: deviceId, tenantId },
    data: {
      locationId: value(formData, "locationId"),
      employeeId: value(formData, "employeeId"),
      workstationId: value(formData, "workstationId"),
      type: (value(formData, "type") ?? "OTHER") as "LAPTOP" | "PC" | "SERVER" | "PRINTER" | "FIREWALL" | "SWITCH" | "ROUTER" | "SMARTPHONE" | "TABLET" | "MONITOR" | "DOCKING_STATION" | "NAS" | "ACCESS_POINT" | "UPS" | "OTHER",
      manufacturer: value(formData, "manufacturer"),
      model: value(formData, "model"),
      serialNumber: value(formData, "serialNumber"),
      inventoryNumber: value(formData, "inventoryNumber"),
      purchaseDate: dateValue(formData, "purchaseDate"),
      warrantyUntil: dateValue(formData, "warrantyUntil"),
      os: value(formData, "os"),
      osVersion: value(formData, "osVersion"),
      ipAddress: value(formData, "ipAddress"),
      macAddress: value(formData, "macAddress"),
      hostname: value(formData, "hostname"),
      status: (value(formData, "status") ?? "ACTIVE") as "ACTIVE" | "IN_STORAGE" | "IN_REPAIR" | "DECOMMISSIONED" | "LOST",
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/devices`);
  revalidatePath(`/tenants/${tenantId}/devices/${deviceId}`);
  redirect(`/tenants/${tenantId}/devices/${deviceId}`);
}

export async function deleteDevice(tenantId: string, deviceId: string) {
  await requireTenant(tenantId, can.manageDevices);
  await prisma.device.deleteMany({ where: { id: deviceId, tenantId } });
  revalidatePath(`/tenants/${tenantId}/devices`);
  redirect(`/tenants/${tenantId}/devices`);
}

export async function createWorkstation(tenantId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageDevices);
  const workstation = await prisma.workstation.create({
    data: {
      tenantId,
      locationId: value(formData, "locationId"),
      employeeId: value(formData, "employeeId"),
      name: requiredValue(formData, "name", "Name"),
      room: value(formData, "room"),
      networkOutlet: value(formData, "networkOutlet"),
      ipAddress: value(formData, "ipAddress"),
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/workstations`);
  redirect(`/tenants/${tenantId}/workstations/${workstation.id}`);
}

export async function updateWorkstation(tenantId: string, workstationId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageDevices);
  await prisma.workstation.updateMany({
    where: { id: workstationId, tenantId },
    data: {
      locationId: value(formData, "locationId"),
      employeeId: value(formData, "employeeId"),
      name: requiredValue(formData, "name", "Name"),
      room: value(formData, "room"),
      networkOutlet: value(formData, "networkOutlet"),
      ipAddress: value(formData, "ipAddress"),
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/workstations`);
  revalidatePath(`/tenants/${tenantId}/workstations/${workstationId}`);
  redirect(`/tenants/${tenantId}/workstations/${workstationId}`);
}

export async function deleteWorkstation(tenantId: string, workstationId: string) {
  await requireTenant(tenantId, can.manageDevices);
  await prisma.workstation.deleteMany({ where: { id: workstationId, tenantId } });
  revalidatePath(`/tenants/${tenantId}/workstations`);
  redirect(`/tenants/${tenantId}/workstations`);
}

export async function createSoftware(tenantId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageSoftware);
  const software = await prisma.software.create({
    data: {
      tenantId,
      name: requiredValue(formData, "name", "Name"),
      vendor: value(formData, "vendor"),
      version: value(formData, "version"),
      licenseType: (value(formData, "licenseType") ?? "PERPETUAL") as "PERPETUAL" | "SUBSCRIPTION" | "VOLUME" | "OEM" | "FREEWARE" | "OPEN_SOURCE" | "TRIAL",
      licenseKey: value(formData, "licenseKey"),
      licenseCount: intValue(formData, "licenseCount"),
      validFrom: dateValue(formData, "validFrom"),
      validUntil: dateValue(formData, "validUntil"),
      costCenter: value(formData, "costCenter"),
      purchasePrice: decimalValue(formData, "purchasePrice"),
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    } as Parameters<typeof prisma.software.create>[0]["data"],
  });
  revalidatePath(`/tenants/${tenantId}/software`);
  redirect(`/tenants/${tenantId}/software/${software.id}`);
}

export async function updateSoftware(tenantId: string, softwareId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageSoftware);
  await prisma.software.updateMany({
    where: { id: softwareId, tenantId },
    data: {
      name: requiredValue(formData, "name", "Name"),
      vendor: value(formData, "vendor"),
      version: value(formData, "version"),
      licenseType: (value(formData, "licenseType") ?? "PERPETUAL") as "PERPETUAL" | "SUBSCRIPTION" | "VOLUME" | "OEM" | "FREEWARE" | "OPEN_SOURCE" | "TRIAL",
      licenseKey: value(formData, "licenseKey"),
      licenseCount: intValue(formData, "licenseCount"),
      validFrom: dateValue(formData, "validFrom"),
      validUntil: dateValue(formData, "validUntil"),
      costCenter: value(formData, "costCenter"),
      purchasePrice: decimalValue(formData, "purchasePrice"),
      notes: value(formData, "notes"),
      externalRef: value(formData, "externalRef"),
    } as Parameters<typeof prisma.software.updateMany>[0]["data"],
  });
  revalidatePath(`/tenants/${tenantId}/software`);
  revalidatePath(`/tenants/${tenantId}/software/${softwareId}`);
  redirect(`/tenants/${tenantId}/software/${softwareId}`);
}

export async function deleteSoftware(tenantId: string, softwareId: string) {
  await requireTenant(tenantId, can.manageSoftware);
  await prisma.software.deleteMany({ where: { id: softwareId, tenantId } });
  revalidatePath(`/tenants/${tenantId}/software`);
  redirect(`/tenants/${tenantId}/software`);
}

export async function createCredential(tenantId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageCredentials);
  const password = value(formData, "password");
  const notes = value(formData, "notes");
  const credential = await prisma.credential.create({
    data: {
      tenantId,
      employeeId: value(formData, "employeeId"),
      name: requiredValue(formData, "name", "Name"),
      username: value(formData, "username"),
      encryptedPassword: password ? encrypt(password) : null,
      encryptedNotes: notes ? encrypt(notes) : null,
      url: value(formData, "url"),
      category: value(formData, "category"),
      expiresAt: dateValue(formData, "expiresAt"),
      lastRotatedAt: password ? new Date() : null,
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/credentials`);
  redirect(`/tenants/${tenantId}/credentials/${credential.id}`);
}

export async function updateCredential(tenantId: string, credentialId: string, formData: FormData) {
  await requireTenant(tenantId, can.manageCredentials);
  const password = value(formData, "password");
  const notes = value(formData, "notes");
  await prisma.credential.updateMany({
    where: { id: credentialId, tenantId },
    data: {
      employeeId: value(formData, "employeeId"),
      name: requiredValue(formData, "name", "Name"),
      username: value(formData, "username"),
      ...(password ? { encryptedPassword: encrypt(password), lastRotatedAt: new Date() } : {}),
      encryptedNotes: notes ? encrypt(notes) : null,
      url: value(formData, "url"),
      category: value(formData, "category"),
      expiresAt: dateValue(formData, "expiresAt"),
      externalRef: value(formData, "externalRef"),
    },
  });
  revalidatePath(`/tenants/${tenantId}/credentials`);
  revalidatePath(`/tenants/${tenantId}/credentials/${credentialId}`);
  redirect(`/tenants/${tenantId}/credentials/${credentialId}`);
}

export async function deleteCredential(tenantId: string, credentialId: string) {
  await requireTenant(tenantId, can.manageCredentials);
  await prisma.credential.deleteMany({ where: { id: credentialId, tenantId } });
  revalidatePath(`/tenants/${tenantId}/credentials`);
  redirect(`/tenants/${tenantId}/credentials`);
}

export async function createTicket(tenantId: string, formData: FormData) {
  const ctx = await requireTenant(tenantId, () => true);
  const counter = await prisma.ticketCounter.upsert({
    where: { tenantId },
    update: { lastNumber: { increment: 1 } },
    create: { tenantId, lastNumber: 1 },
  });
  const ticket = await prisma.ticket.create({
    data: {
      tenantId,
      number: counter.lastNumber,
      title: requiredValue(formData, "title", "Titel"),
      description: requiredValue(formData, "description", "Beschreibung"),
      category: (value(formData, "category") ?? "OTHER") as "HARDWARE" | "SOFTWARE" | "EMAIL" | "NETWORK" | "USER_ACCOUNT" | "PRINTER" | "PHONE" | "VPN" | "OTHER",
      priority: (value(formData, "priority") ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      employeeId: value(formData, "employeeId"),
      workstationId: value(formData, "workstationId"),
      deviceId: value(formData, "deviceId"),
      createdById: ctx.userId,
    },
  });
  revalidatePath(`/tenants/${tenantId}/tickets`);
  redirect(`/tenants/${tenantId}/tickets/${ticket.id}`);
}
