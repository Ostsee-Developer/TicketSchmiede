import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/setup-account",
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/icons",
];

function hasSessionCookie(req: NextRequest) {
  return req.cookies
    .getAll()
    .some((cookie) =>
      cookie.name === "authjs.session-token" ||
      cookie.name === "__Secure-authjs.session-token" ||
      cookie.name.startsWith("authjs.session-token.") ||
      cookie.name.startsWith("__Secure-authjs.session-token.")
    );
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  if (!hasSessionCookie(req)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root path: let page.tsx handle role-based redirect
  if (pathname === "/") return NextResponse.next();

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|public).*)"],
};
