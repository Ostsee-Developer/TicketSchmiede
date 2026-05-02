import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, errors?: unknown) {
  return NextResponse.json(
    { success: false, error: message, errors },
    { status: 400 }
  );
}

export function unauthorized(message = "Nicht authentifiziert") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = "Keine Berechtigung") {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

export function notFound(message = "Nicht gefunden") {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}


export function serverError(error: unknown) {
  console.error("[API Error]", error);
  const message =
    process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "Interner Serverfehler";
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export function handleZodError(error: ZodError) {
  return badRequest("Validierungsfehler", error.flatten().fieldErrors);
}

export function getPagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
