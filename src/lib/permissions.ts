import { Role } from "@prisma/client";

// Neue fachliche Rollenbegriffe (DB-Enum bleibt vorerst kompatibel bestehen):
// SYSTEMADMIN -> SUPER_ADMIN
// ADMIN       -> INTERNAL_ADMIN + CUSTOMER_ADMIN
// TECHNIKER   -> TECHNICIAN
// VERWALTUNG  -> READ_ONLY
// MITARBEITER -> CUSTOMER_USER
const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 100,
  INTERNAL_ADMIN: 80,
  TECHNICIAN: 60,
  READ_ONLY: 40,
  CUSTOMER_ADMIN: 30,
  CUSTOMER_USER: 10,
};

const INTERNAL_ROLES: Role[] = [Role.SUPER_ADMIN, Role.INTERNAL_ADMIN, Role.TECHNICIAN, Role.READ_ONLY];
const CUSTOMER_ROLES: Role[] = [Role.CUSTOMER_ADMIN, Role.CUSTOMER_USER];
const STAFF_OR_CUSTOMER_ADMIN: Role[] = [Role.SUPER_ADMIN, Role.INTERNAL_ADMIN, Role.TECHNICIAN, Role.CUSTOMER_ADMIN];

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function isInternalRole(role: Role): boolean {
  return INTERNAL_ROLES.includes(role);
}

export function isCustomerRole(role: Role): boolean {
  return CUSTOMER_ROLES.includes(role);
}

export const can = {
  manageTenants: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  viewAllTenants: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  manageEmployees: (role: Role) => STAFF_OR_CUSTOMER_ADMIN.includes(role),
  viewEmployees: (role: Role) => isInternalRole(role) || role === Role.CUSTOMER_ADMIN,
  viewEmployeeNames: (_role: Role) => true,

  manageDevices: (role: Role) => STAFF_OR_CUSTOMER_ADMIN.includes(role),
  viewDevices: (role: Role) => isInternalRole(role) || role === Role.CUSTOMER_ADMIN,

  manageSoftware: (role: Role) => STAFF_OR_CUSTOMER_ADMIN.includes(role),
  viewSoftware: (role: Role) => isInternalRole(role) || role === Role.CUSTOMER_ADMIN,
  viewLicenseKeys: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  viewCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  revealCredentials: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  manageCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  manageTickets: (role: Role) => STAFF_OR_CUSTOMER_ADMIN.includes(role),
  assignTickets: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewInternalNotes: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  viewAllTenantTickets: (role: Role) => isInternalRole(role) || role === Role.CUSTOMER_ADMIN,
  createTickets: (_role: Role) => true,
  viewOwnTickets: (_role: Role) => true,

  manageUsers: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  managePermissions: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  exportWithPasswords: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  exportWithoutPasswords: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  importData: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  viewAuditLog: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  viewAdminDashboard: (role: Role) => role !== Role.CUSTOMER_USER,
};

export { Role };
