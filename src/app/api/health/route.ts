import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "Ticket Schmiede",
    });
  } catch {
    return NextResponse.json(
      { status: "error", error: "Database connection failed" },
      { status: 503 }
    );
  }
}
