import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticator } from "otplib";
import { createAuditLog, getClientInfo } from "./audit";
import { safeDecrypt } from "./encryption";
import { getLoginPolicy, passkeyLoginAllowed, passwordLoginAllowed } from "./security-settings";
import {
  getWebAuthnRequestInfo,
  verifyAuthenticationResponse,
  type AuthenticationCredentialJson,
} from "./webauthn";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  totp: z.string().optional(),
  mode: z.enum(["password", "passkey"]).default("password"),
  assertion: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: Number(process.env.SESSION_DURATION ?? 28800),
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        mode: { label: "Modus", type: "text" },
        assertion: { label: "Passkey Assertion", type: "text" },
      },
      async authorize(credentials, request) {
        try {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.error("[auth] Schema validation failed:", parsed.error.flatten());
          return null;
        }

        const { email, mode } = parsed.data;
        let ipAddress: string | null = null;
        let userAgent: string | null = null;
        try {
          const info = getClientInfo(request as Request);
          ipAddress = info.ipAddress;
          userAgent = info.userAgent;
        } catch (_e) {
          console.warn("[auth] getClientInfo failed, continuing without IP/UA");
        }
        const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5);
        const lockoutMinutes = Number(process.env.LOCKOUT_DURATION ?? 15);
        const loginPolicy = await getLoginPolicy();

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            isSuperAdmin: true,
            isActive: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            failedLoginCount: true,
            lockedUntil: true,
            passkeys: {
              select: {
                id: true,
                credentialId: true,
                publicKey: true,
                counter: true,
              },
            },
          },
        });
        console.log(`[auth] Login attempt: ${email} → found=${!!user} active=${user?.isActive ?? "n/a"}`);

        if (!user || !user.isActive) {
          await createAuditLog({
            action: "LOGIN_FAILED",
            userEmail: email,
            details: { reason: user ? "account_disabled" : "user_not_found" },
            ipAddress,
            userAgent,
          });
          return null;
        }

        // Check lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            action: "LOGIN_FAILED",
            details: { reason: "account_locked", lockedUntil: user.lockedUntil },
            ipAddress,
            userAgent,
          });
          return null;
        }

        if (mode === "passkey") {
          if (!passkeyLoginAllowed(loginPolicy)) {
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              action: "LOGIN_FAILED",
              details: { reason: "passkey_login_disabled" },
              ipAddress,
              userAgent,
            });
            return null;
          }

          if (!parsed.data.assertion) {
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              action: "LOGIN_FAILED",
              details: { reason: "missing_passkey_assertion" },
              ipAddress,
              userAgent,
            });
            return null;
          }

          const assertion = JSON.parse(parsed.data.assertion) as AuthenticationCredentialJson;
          const credential = user.passkeys.find((passkey) => passkey.credentialId === assertion.rawId);
          if (!credential) {
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              action: "LOGIN_FAILED",
              details: { reason: "unknown_passkey" },
              ipAddress,
              userAgent,
            });
            return null;
          }

          const challenge = await prisma.webAuthnChallenge.findFirst({
            where: {
              userId: user.id,
              type: "authentication",
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
          });
          if (!challenge) {
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              action: "LOGIN_FAILED",
              details: { reason: "missing_or_expired_passkey_challenge" },
              ipAddress,
              userAgent,
            });
            return null;
          }

          const webAuthn = getWebAuthnRequestInfo(request as Request);
          const verified = verifyAuthenticationResponse({
            credential: assertion,
            expectedChallenge: challenge.challenge,
            expectedOrigin: webAuthn.origin,
            rpId: webAuthn.rpId,
            storedCredentialId: credential.credentialId,
            publicKey: credential.publicKey,
            counter: credential.counter,
          });

          await prisma.$transaction([
            prisma.passkeyCredential.update({
              where: { id: credential.id },
              data: { counter: verified.counter, lastUsedAt: new Date() },
            }),
            prisma.webAuthnChallenge.deleteMany({
              where: { userId: user.id, type: "authentication" },
            }),
            prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginCount: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
                lastLoginIp: ipAddress,
              },
            }),
          ]);

          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            action: "PASSKEY_LOGIN",
            details: { success: true, credentialId: credential.id },
            ipAddress,
            userAgent,
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin,
          };
        }

        if (!passwordLoginAllowed(loginPolicy)) {
          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            action: "LOGIN_FAILED",
            details: { reason: "password_login_disabled" },
            ipAddress,
            userAgent,
          });
          return null;
        }

        const password = parsed.data.password;
        if (!password) return null;

        const { totp } = parsed.data;
        const passwordValid = await bcrypt.compare(password, user.passwordHash);

        if (!passwordValid) {
          const newFailCount = user.failedLoginCount + 1;
          const shouldLock = newFailCount >= maxAttempts;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: newFailCount,
              lockedUntil: shouldLock
                ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
                : null,
            },
          });

          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            action: "LOGIN_FAILED",
            details: { reason: "invalid_password", attempts: newFailCount },
            ipAddress,
            userAgent,
          });

          if (shouldLock) {
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              action: "USER_LOCK",
              details: { reason: "max_attempts_exceeded" },
              ipAddress,
              userAgent,
            });
          }
          return null;
        }

        // Verify TOTP if 2FA is enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const secret = safeDecrypt(user.twoFactorSecret);
          if (!secret) {
            console.error("[auth] Failed to decrypt 2FA secret for user:", user.id);
            return null;
          }
          if (!totp || !authenticator.verify({ token: totp, secret })) {
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              action: "LOGIN_FAILED",
              details: { reason: "invalid_totp" },
              ipAddress,
              userAgent,
            });
            return null;
          }
        }

        // Successful login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
          },
        });

        await createAuditLog({
          userId: user.id,
          userEmail: user.email,
          action: "LOGIN",
          details: { success: true },
          ipAddress,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
        };
        } catch (err) {
          console.error("[auth] Unexpected error in authorize:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      }
      return session;
    },
  },
});

// Type augmentation
declare module "next-auth" {
  interface User {
    isSuperAdmin?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isSuperAdmin: boolean;
    };
  }
}
