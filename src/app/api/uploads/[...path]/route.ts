import { readFile, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

type RouteContext = { params: Promise<{ path?: string[] }> };

function getUploadRoot() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
}

function textResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function resolveUploadedFile(context: RouteContext) {
  const { path: segments = [] } = await context.params;
  if (!segments.length) return { error: textResponse("Not found", 404) };

  const uploadRoot = getUploadRoot();
  const requestedPath = path.resolve(uploadRoot, ...segments);

  if (requestedPath !== uploadRoot && !requestedPath.startsWith(uploadRoot + path.sep)) {
    return { error: textResponse("Forbidden", 403) };
  }

  const fileStat = await stat(requestedPath);
  if (!fileStat.isFile()) return { error: textResponse("Not found", 404) };

  const contentType = CONTENT_TYPES[path.extname(requestedPath).toLowerCase()] ?? "application/octet-stream";

  return {
    requestedPath,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveUploadedFile(context);
    if (resolved.error) return resolved.error;

    const file = await readFile(resolved.requestedPath);
    const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;

    return new NextResponse(body, { headers: resolved.headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return textResponse("Not found", 404);
    return serverError(error);
  }
}

export async function HEAD(_request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveUploadedFile(context);
    if (resolved.error) return resolved.error;
    return new NextResponse(null, { headers: resolved.headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return textResponse("Not found", 404);
    return serverError(error);
  }
}
