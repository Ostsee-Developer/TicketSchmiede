-- Migration: Multi-tenant system fixes
-- Adds OsType enum, Credential remote-access fields, Device→Credential relation, Tenant soft-delete

-- CreateEnum OsType
CREATE TYPE "OsType" AS ENUM (
  'WINDOWS_10',
  'WINDOWS_11',
  'WINDOWS_SERVER_2019',
  'WINDOWS_SERVER_2022',
  'WINDOWS_SERVER_2025',
  'MACOS',
  'LINUX',
  'UBUNTU',
  'DEBIAN',
  'CENTOS',
  'RHEL',
  'OTHER'
);

-- AlterTable Device: change os column from TEXT to OsType enum
-- First migrate existing data (map known strings to enum values)
ALTER TABLE "Device"
  ADD COLUMN "os_new" "OsType";

UPDATE "Device" SET "os_new" = CASE
  WHEN lower("os") LIKE '%windows 10%' THEN 'WINDOWS_10'::"OsType"
  WHEN lower("os") LIKE '%windows 11%' THEN 'WINDOWS_11'::"OsType"
  WHEN lower("os") LIKE '%server 2019%' THEN 'WINDOWS_SERVER_2019'::"OsType"
  WHEN lower("os") LIKE '%server 2022%' THEN 'WINDOWS_SERVER_2022'::"OsType"
  WHEN lower("os") LIKE '%server 2025%' THEN 'WINDOWS_SERVER_2025'::"OsType"
  WHEN lower("os") LIKE '%macos%' OR lower("os") LIKE '%mac os%' THEN 'MACOS'::"OsType"
  WHEN lower("os") LIKE '%ubuntu%' THEN 'UBUNTU'::"OsType"
  WHEN lower("os") LIKE '%debian%' THEN 'DEBIAN'::"OsType"
  WHEN lower("os") LIKE '%centos%' THEN 'CENTOS'::"OsType"
  WHEN lower("os") LIKE '%rhel%' OR lower("os") LIKE '%red hat%' THEN 'RHEL'::"OsType"
  WHEN lower("os") LIKE '%linux%' THEN 'LINUX'::"OsType"
  WHEN "os" IS NOT NULL THEN 'OTHER'::"OsType"
  ELSE NULL
END
WHERE "os" IS NOT NULL;

ALTER TABLE "Device" DROP COLUMN "os";
ALTER TABLE "Device" RENAME COLUMN "os_new" TO "os";

-- AlterTable Tenant: add soft-delete column
ALTER TABLE "Tenant" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable Credential: add remote access fields and deviceId
ALTER TABLE "Credential"
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "rustdeskId" TEXT,
  ADD COLUMN "encryptedRustdeskPassword" TEXT,
  ADD COLUMN "teamviewerId" TEXT,
  ADD COLUMN "encryptedTeamviewerPassword" TEXT;

-- AddForeignKey Credential.deviceId -> Device.id
ALTER TABLE "Credential"
  ADD CONSTRAINT "Credential_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for Credential.deviceId
CREATE INDEX "Credential_deviceId_idx" ON "Credential"("deviceId");
