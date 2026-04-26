import {
  Tenant,
  Location,
  User,
  UserTenantRole,
  Employee,
  Workstation,
  Device,
  Software,
  Credential,
  CredentialTemplate,
  Ticket,
  TicketComment,
  File as DbFile,
  AuditLog,
  ImportJob,
  ExportJob,
  Role,
  EmployeeStatus,
  DeviceType,
  DeviceStatus,
  LicenseType,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "@prisma/client";

// Re-export Prisma types
export {
  Role,
  EmployeeStatus,
  DeviceType,
  DeviceStatus,
  LicenseType,
  TicketStatus,
  TicketPriority,
  TicketCategory,
};

// Safe user type (without passwordHash)
export type SafeUser = Omit<User, "passwordHash" | "twoFactorSecret">;

// Employee with relations
export type EmployeeWithRelations = Employee & {
  location?: Location | null;
  workstation?: Workstation | null;
  devices?: Device[];
  credentials?: Omit<Credential, "encryptedPassword" | "encryptedNotes">[];
};

// Device with relations
export type DeviceWithRelations = Device & {
  location?: Location | null;
  employee?: Pick<Employee, "id" | "firstName" | "lastName"> | null;
  workstation?: Pick<Workstation, "id" | "name"> | null;
};

// Ticket with relations
export type TicketWithRelations = Ticket & {
  employee?: Pick<Employee, "id" | "firstName" | "lastName"> | null;
  technician?: Pick<User, "id" | "name" | "email"> | null;
  createdBy: Pick<User, "id" | "name" | "email">;
  device?: Pick<Device, "id" | "type" | "manufacturer" | "model"> | null;
  workstation?: Pick<Workstation, "id" | "name"> | null;
  comments?: TicketComment[];
  _count?: { comments: number; files: number };
};

// Credential safe (without decrypted password)
export type CredentialSafe = Omit<Credential, "encryptedPassword" | "encryptedNotes"> & {
  hasPassword: boolean;
};

// Credential revealed (with decrypted password - only for authorized users)
export type CredentialRevealed = CredentialSafe & {
  password: string | null;
  notes: string | null;
};

// Dashboard statistics
export interface DashboardStats {
  openTickets: number;
  criticalTickets: number;
  ticketsByStatus: Record<TicketStatus, number>;
  ticketsByPriority: Record<TicketPriority, number>;
  expiringLicenses: Array<Software & { daysUntilExpiry: number }>;
  expiringWarranties: Array<Device & { daysUntilExpiry: number }>;
  devicesWithoutAssignment: number;
  employeesWithoutWorkstation: number;
  recentActivity: AuditLog[];
}

// Import result
export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: Array<{ row: number; field: string; message: string }>;
  skipped: number;
}

// API Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Re-export Prisma model types
export type {
  Tenant,
  Location,
  User,
  UserTenantRole,
  Employee,
  Workstation,
  Device,
  Software,
  Credential,
  CredentialTemplate,
  Ticket,
  TicketComment,
  DbFile,
  AuditLog,
  ImportJob,
  ExportJob,
};
