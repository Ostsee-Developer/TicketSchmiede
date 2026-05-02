ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSKEY_REGISTER';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSKEY_LOGIN';

CREATE TABLE IF NOT EXISTS "PasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" TEXT,
  "name" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");
CREATE INDEX IF NOT EXISTS "PasskeyCredential_userId_idx" ON "PasskeyCredential"("userId");

ALTER TABLE "PasskeyCredential"
  ADD CONSTRAINT "PasskeyCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WebAuthnChallenge" (
  "id" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_key" ON "WebAuthnChallenge"("challenge");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_idx" ON "WebAuthnChallenge"("challenge");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_userId_idx" ON "WebAuthnChallenge"("userId");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "SystemSetting" ("key", "value")
VALUES ('loginPolicy', '"PASSWORD_AND_PASSKEY"'::jsonb)
ON CONFLICT ("key") DO NOTHING;
