import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        passwordHash: true,
        twoFactorEnabled: true,
        lockedUntil: true,
        failedLoginCount: true,
      },
    });

    if (!user || !user.isActive) {
      // Return a generic response — don't reveal if the user exists
      return NextResponse.json({ requiresTotp: false });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json({ error: "Konto gesperrt" }, { status: 403 });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    return NextResponse.json({ requiresTotp: user.twoFactorEnabled });
  } catch {
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
