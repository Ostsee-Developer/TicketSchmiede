import { Role } from "@prisma/client";

// Role hierarchy (higher = more permissions)
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

// Permission checks by feature
export const can = {
  // Tenant management
  manageTenants: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  viewAllTenants: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // Employee management
  manageEmployees: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewEmployees: (role: Role) => isInternalRole(role),
  viewEmployeeNames: (_role: Role) => true, // customers can see names for tickets

  // Device & Workstation
  manageDevices: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewDevices: (role: Role) => isInternalRole(role),

  // Software
  manageSoftware: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewSoftware: (role: Role) => isInternalRole(role),

  // Credentials
  viewCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  revealCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  manageCredentials: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // Tickets - internal
  manageTickets: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  assignTickets: (role: Role) => hasMinRole(role, Role.TECHNICIAN),
  viewInternalNotes: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // Tickets - customer
  createTickets: (_role: Role) => true,
  viewOwnTickets: (_role: Role) => true,

  // Users & Permissions
  manageUsers: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  managePermissions: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // Export
  exportWithPasswords: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),
  exportWithoutPasswords: (role: Role) => hasMinRole(role, Role.TECHNICIAN),

  // Import
  importData: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // Audit log
  viewAuditLog: (role: Role) => hasMinRole(role, Role.INTERNAL_ADMIN),

  // Dashboard
  viewAdminDashboard: (role: Role) => isInternalRole(role),
};

export { Role };
