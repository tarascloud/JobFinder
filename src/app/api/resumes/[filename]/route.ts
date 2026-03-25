import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

/** Persistent data directory — matches upload-resume route */
const DATA_RESUMES_DIR = path.join(
  process.env.DATA_DIR || "/app/data",
  "resumes"
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Sanitize: only allow alphanumeric, dash, dot, underscore
    if (!/^[\w.-]+$/.test(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(DATA_RESUMES_DIR, filename);

    // Prevent path traversal
    if (!filePath.startsWith(DATA_RESUMES_DIR)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(filePath);

    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".html"
          ? "text/html"
          : "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    console.error("Serve resume error:", e);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
