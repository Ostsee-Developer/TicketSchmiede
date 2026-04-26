import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAuditLog, getClientInfo } from "./audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const { ipAddress, userAgent } = getClientInfo(request as Request);
        const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5);
        const lockoutMinutes = Number(process.env.LOCKOUT_DURATION ?? 15);

        const user = await prisma.user.findUnique({ where: { email } });

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
