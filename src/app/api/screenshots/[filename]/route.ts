import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Persistent data directory — matches helpers.ts SCREENSHOTS_DIR */
const DATA_SCREENSHOTS_DIR = path.join(
  process.env.DATA_DIR || "/app/data",
  "screenshots"
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    const { filename } = await params;

    // Sanitize: only allow alphanumeric, dash, dot, underscore
    if (!/^[\w.-]+$/.test(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(DATA_SCREENSHOTS_DIR, filename);

    // Prevent path traversal
    if (!filePath.startsWith(DATA_SCREENSHOTS_DIR)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Verify ownership: the screenshot must belong to an application owned by the current user
    const screenshotRef = `/api/screenshots/${filename}`;
    const ownerCheck = await prisma.application.findFirst({
      where: { userId, screenshotPath: screenshotRef },
      select: { id: true },
    });

    if (!ownerCheck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    console.error("Serve screenshot error:", e);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
