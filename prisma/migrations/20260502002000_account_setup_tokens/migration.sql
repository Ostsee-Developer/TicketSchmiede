CREATE TABLE IF NOT EXISTS "AccountSetupToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountSetupToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountSetupToken_tokenHash_key" ON "AccountSetupToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "AccountSetupToken_userId_idx" ON "AccountSetupToken"("userId");
CREATE INDEX IF NOT EXISTS "AccountSetupToken_expiresAt_idx" ON "AccountSetupToken"("expiresAt");

ALTER TABLE "AccountSetupToken"
  ADD CONSTRAINT "AccountSetupToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
