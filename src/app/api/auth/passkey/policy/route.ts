import { NextResponse } from "next/server";
import { getLoginPolicy } from "@/lib/security-settings";

export async function GET() {
  const policy = await getLoginPolicy();
  return NextResponse.json({ success: true, data: { policy } });
}
