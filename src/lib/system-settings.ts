import { access, cp, mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { spawn } from "child_process";
import { Prisma } from "@prisma/client";
import { encrypt, safeDecrypt } from "./encryption";
import { prisma } from "./prisma";

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  passwordSet: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  directory: string;
  retentionDays: number;
  includeAuditLog: boolean;
  includeSecrets: boolean;
  includeDatabase: boolean;
  includeFiles: boolean;
}

export const DEFAULT_SMTP_SETTINGS: SmtpSettings = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  from: "",
  passwordSet: false,
};

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: true,
  directory: process.env.BACKUP_DIR || "/app/backups",
  retentionDays: 30,
  includeAuditLog: true,
  includeSecrets: false,
  includeDatabase: true,
  includeFiles: true,
};

const SMTP_KEY = "smtpSettings";
const BACKUP_KEY = "backupSettings";

interface StoredSmtpSettings extends Omit<SmtpSettings, "passwordSet"> {
  encryptedPassword?: string | null;
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: SMTP_KEY }, select: { value: true } });
  const stored = normalizeStoredSmtp(setting?.value);
  return {
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    user: stored.user,
    from: stored.from,
    passwordSet: Boolean(stored.encryptedPassword),
  };
}

export async function getSmtpRuntimeConfig() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: SMTP_KEY }, select: { value: true } });
  const stored = normalizeStoredSmtp(setting?.value);
  const password = stored.encryptedPassword ? safeDecrypt(stored.encryptedPassword) : null;

  if (stored.host && stored.user && password) {
    return {
      host: stored.host,
      port: stored.port,
      secure: stored.secure,
      auth: { user: stored.user, pass: password },
      from: stored.from || stored.user,
    };
  }

  const envHost = process.env.SMTP_HOST;
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASSWORD;
  if (!envHost || !envUser || !envPass) return null;
  return {
    host: envHost,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: envUser, pass: envPass },
    from: process.env.SMTP_FROM ?? envUser,
  };
}

export async function setSmtpSettings(input: Omit<SmtpSettings, "passwordSet"> & { password?: string }) {
  const existing = await prisma.systemSetting.findUnique({ where: { key: SMTP_KEY }, select: { value: true } });
  const current = normalizeStoredSmtp(existing?.value);
  const stored: StoredSmtpSettings = {
    host: input.host.trim(),
    port: Number(input.port || 587),
    secure: Boolean(input.secure),
    user: input.user.trim(),
    from: input.from.trim(),
    encryptedPassword: input.password ? encrypt(input.password) : current.encryptedPassword ?? null,
  };

  await prisma.systemSetting.upsert({
    where: { key: SMTP_KEY },
    create: { key: SMTP_KEY, value: stored as unknown as Prisma.InputJsonObject },
    update: { value: stored as unknown as Prisma.InputJsonObject },
  });
  return getSmtpSettings();
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: BACKUP_KEY }, select: { value: true } });
  return normalizeBackupSettings(setting?.value);
}

export async function setBackupSettings(input: BackupSettings): Promise<BackupSettings> {
  const settings = normalizeBackupSettings(input);
  await prisma.systemSetting.upsert({
    where: { key: BACKUP_KEY },
    create: { key: BACKUP_KEY, value: settings as unknown as Prisma.InputJsonObject },
    update: { value: settings as unknown as Prisma.InputJsonObject },
  });
  return settings;
}

export async function createJsonBackup() {
  const settings = await getBackupSettings();
  const directory = path.resolve(process.cwd(), settings.directory || DEFAULT_BACKUP_SETTINGS.directory);
  await mkdir(directory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const workDir = path.join(directory, `ticket-schmiede-${timestamp}`);
  await mkdir(workDir, { recursive: true });

  const data = await collectBackupData(settings);
  await writeFile(path.join(workDir, "database-prisma-export.json"), JSON.stringify(data, null, 2), "utf8");

  const dbDump = settings.includeDatabase ? await createDatabaseDump(workDir) : { created: false, reason: "disabled" };
  const files = settings.includeFiles ? await copyUploadedFiles(workDir) : { copied: 0, skipped: 0 };
  await writeFile(
    path.join(workDir, "manifest.json"),
    JSON.stringify(
      {
        createdAt: data.createdAt,
        type: "full-backup",
        database: dbDump,
        files,
      },
      null,
      2
    ),
    "utf8"
  );

  const archivePath = path.join(directory, `ticket-schmiede-${timestamp}.tar.gz`);
  await createTarArchive(directory, path.basename(workDir), archivePath);
  const pruned = await pruneOldBackups(directory, settings.retentionDays);
  return { filePath: archivePath, workingDirectory: workDir, createdAt: data.createdAt, database: dbDump, files, pruned };
}

async function collectBackupData(settings: BackupSettings) {
  const [
    tenants,
    users,
    roles,
    locations,
    employees,
    workstations,
    devices,
    software,
    tickets,
    passkeys,
    systemSettings,
    auditLogs,
  ] = await Promise.all([
    prisma.tenant.findMany(),
    prisma.user.findMany(),
    prisma.userTenantRole.findMany(),
    prisma.location.findMany(),
    prisma.employee.findMany(),
    prisma.workstation.findMany(),
    prisma.device.findMany(),
    prisma.software.findMany(),
    prisma.ticket.findMany(),
    prisma.passkeyCredential.findMany(),
    prisma.systemSetting.findMany(),
    settings.includeAuditLog ? prisma.auditLog.findMany({ take: 10000, orderBy: { createdAt: "desc" } }) : [],
  ]);

  return {
    createdAt: new Date().toISOString(),
    version: 1,
    settings: { includeAuditLog: settings.includeAuditLog, includeSecrets: settings.includeSecrets },
    data: {
      tenants,
      users: settings.includeSecrets ? users : users.map(({ passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, ...user }) => user),
      roles,
      locations,
      employees,
      workstations,
      devices,
      software,
      tickets,
      passkeys: settings.includeSecrets ? passkeys : passkeys.map(({ publicKey: _publicKey, ...passkey }) => passkey),
      systemSettings: settings.includeSecrets
        ? systemSettings
        : systemSettings.filter((setting) => setting.key !== SMTP_KEY),
      auditLogs,
    },
  };
}

function normalizeStoredSmtp(value: unknown): StoredSmtpSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SMTP_SETTINGS, encryptedPassword: null };
  const data = value as Record<string, unknown>;
  return {
    host: stringValue(data.host),
    port: numberValue(data.port, 587),
    secure: Boolean(data.secure),
    user: stringValue(data.user),
    from: stringValue(data.from),
    encryptedPassword: typeof data.encryptedPassword === "string" ? data.encryptedPassword : null,
  };
}

function normalizeBackupSettings(value: unknown): BackupSettings {
  if (!value || typeof value !== "object") return DEFAULT_BACKUP_SETTINGS;
  const data = value as Record<string, unknown>;
  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : DEFAULT_BACKUP_SETTINGS.enabled,
    directory: stringValue(data.directory) || DEFAULT_BACKUP_SETTINGS.directory,
    retentionDays: Math.max(1, numberValue(data.retentionDays, DEFAULT_BACKUP_SETTINGS.retentionDays)),
    includeAuditLog: typeof data.includeAuditLog === "boolean" ? data.includeAuditLog : DEFAULT_BACKUP_SETTINGS.includeAuditLog,
    includeSecrets: typeof data.includeSecrets === "boolean" ? data.includeSecrets : DEFAULT_BACKUP_SETTINGS.includeSecrets,
    includeDatabase: typeof data.includeDatabase === "boolean" ? data.includeDatabase : DEFAULT_BACKUP_SETTINGS.includeDatabase,
    includeFiles: typeof data.includeFiles === "boolean" ? data.includeFiles : DEFAULT_BACKUP_SETTINGS.includeFiles,
  };
}

async function createDatabaseDump(workDir: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return { created: false, reason: "DATABASE_URL missing" };

  const pgDumpAvailable = await commandAvailable("pg_dump");
  if (!pgDumpAvailable) {
    return {
      created: false,
      reason: "pg_dump not found; database-prisma-export.json was created as fallback",
    };
  }

  const dumpPath = path.join(workDir, "database.dump");
  await runCommand("pg_dump", ["--format=custom", "--no-owner", "--file", dumpPath, databaseUrl], process.cwd());
  return { created: true, file: "database.dump", format: "pg_dump custom" };
}

async function copyUploadedFiles(workDir: string) {
  const targetRoot = path.join(workDir, "files");
  await mkdir(targetRoot, { recursive: true });
  let copied = 0;
  let skipped = 0;

  const sourceDirs = await uniqueExistingSourceDirs([
    process.env.UPLOAD_DIR,
    process.env.FILE_STORAGE_PATH,
    "uploads",
    "/app/uploads",
    "public/uploads",
    "storage",
  ].filter(Boolean) as string[]);

  for (const { label, absolute } of sourceDirs) {
    await cp(absolute, path.join(targetRoot, "directories", sanitizePathSegment(label)), {
      recursive: true,
      force: true,
    });
    copied += 1;
  }

  const dbFiles = await prisma.file.findMany({ select: { storagePath: true, originalName: true } });
  for (const file of dbFiles) {
    const source = resolveStoredFilePath(file.storagePath);
    if (!source || !(await pathExists(source))) {
      skipped += 1;
      continue;
    }
    const destination = path.join(targetRoot, "referenced", sanitizePathSegment(file.storagePath || file.originalName));
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { force: true });
    copied += 1;
  }

  return { copied, skipped };
}

function resolveStoredFilePath(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  if (/^s3:\/\//i.test(storagePath)) return null;

  const uploadRoot = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");

  if (storagePath.startsWith("/api/uploads/")) {
    return path.resolve(uploadRoot, storagePath.replace(/^\/api\/uploads\//, ""));
  }

  if (storagePath.startsWith("/uploads/")) {
    return path.resolve(process.cwd(), "public", storagePath.replace(/^\//, ""));
  }

  return path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);
}

async function uniqueExistingSourceDirs(sources: string[]) {
  const seen = new Set<string>();
  const result: Array<{ label: string; absolute: string }> = [];

  for (const source of sources) {
    const absolute = path.resolve(process.cwd(), source);
    if (seen.has(absolute) || !(await pathExists(absolute))) continue;
    seen.add(absolute);
    result.push({ label: source, absolute });
  }

  return result;
}

async function pruneOldBackups(directory: string, retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.name.startsWith("ticket-schmiede-")) return;

        const fullPath = path.join(directory, entry.name);
        const entryStat = await stat(fullPath);
        if (entryStat.mtimeMs >= cutoff) return;

        if (entry.isFile() && entry.name.endsWith(".tar.gz")) {
          await rm(fullPath, { force: true });
          removed += 1;
        }

        if (entry.isDirectory()) {
          await rm(fullPath, { recursive: true, force: true });
          removed += 1;
        }
      })
    );
  } catch {
    return { removed, skipped: true };
  }

  return { removed, skipped: false };
}

async function createTarArchive(cwd: string, sourceName: string, archivePath: string) {
  await runCommand("tar", ["-czf", archivePath, sourceName], cwd);
}

async function commandAvailable(command: string) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  try {
    await runCommand(lookup, [command], process.cwd());
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

async function pathExists(target: string) {
  try {
    await access(target, constants.R_OK);
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function sanitizePathSegment(value: string) {
  return value.replace(/^[a-z]:/i, "").replace(/[\\/:"*?<>|]+/g, "_").replace(/^_+/, "") || "file";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
