import { Role } from "@prisma/client";

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 100,
  INTERNAL_ADMIN: 80,
  TECHNICIAN: 60,
  READ_ONLY: 40,
  CUSTOMER_ADMIN: 20,
  CUSTOMER_USER: 10,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function isInternalRole(role: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[Role.READ_ONLY];
}

export function isCustomerRole(role: Role): boolean {
  return ROLE_HIERARCHY[role] < ROLE_HIERARCHY[Role.READ_ONLY];
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

export const can = {
  // ── Tenant management ──────────────────────────────────────────────────────
  manageTenants: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  viewAllTenants: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // ── Employees ──────────────────────────────────────────────────────────────
  manageEmployees: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  // Internal staff + CUSTOMER_ADMIN may see the employee list
  viewEmployees: (role: Role) =>
    isInternalRole(role) || role === Role.CUSTOMER_ADMIN,
  viewEmployeeNames: (_role: Role) => true, // needed for ticket creation by customers

  // ── Devices & Workstations ─────────────────────────────────────────────────
  manageDevices: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewDevices: (role: Role) => isInternalRole(role),

  // ── Software / Lizenzen ────────────────────────────────────────────────────
  manageSoftware: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewSoftware: (role: Role) => isInternalRole(role),
  // License keys are sensitive — only INTERNAL_ADMIN and above may see them
  viewLicenseKeys: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // ── Credentials / Zugangsdaten ─────────────────────────────────────────────
  // TECHNICIAN may see the credential list (name, username, URL) but NOT passwords
  viewCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  // Only INTERNAL_ADMIN+ may call /reveal and get the decrypted password
  revealCredentials: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  manageCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // ── Tickets – internal staff ───────────────────────────────────────────────
  manageTickets: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  assignTickets: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewInternalNotes: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // ── Tickets – customer roles ───────────────────────────────────────────────
  // CUSTOMER_ADMIN sees every ticket of their tenant; CUSTOMER_USER sees only own
  viewAllTenantTickets: (role: Role) =>
    isInternalRole(role) || role === Role.CUSTOMER_ADMIN,
  createTickets: (_role: Role) => true,
  viewOwnTickets: (_role: Role) => true,

  // ── Users & Permissions ────────────────────────────────────────────────────
  manageUsers: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  managePermissions: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // ── Export / Import ────────────────────────────────────────────────────────
  exportWithPasswords: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  exportWithoutPasswords: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  importData: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // ── Audit log ──────────────────────────────────────────────────────────────
  viewAuditLog: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // ── Dashboard ──────────────────────────────────────────────────────────────
  viewAdminDashboard: (role: Role) => isInternalRole(role),
};

export { Role };
