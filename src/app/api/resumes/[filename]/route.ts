import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyDemoToken, DEMO_COOKIE } from "@/lib/demo-token";

/** Persistent data directory — matches upload-resume route */
const DATA_RESUMES_DIR = path.join(
  process.env.DATA_DIR || "/app/data",
  "resumes"
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // Determine the requesting user's ID
    let userId: number | null = null;

    // Check demo mode
    const demoToken = request.cookies.get(DEMO_COOKIE)?.value;
    if (demoToken && (await verifyDemoToken(demoToken))) {
      // Demo user has id = 0 (no real resumes)
      userId = 0;
    } else {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = dbUser.id;
    }

    const { filename } = await params;

    // Sanitize: only allow alphanumeric, dash, dot, underscore
    if (!/^[\w.-]+$/.test(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Verify ownership: filename must start with "{userId}-"
    // Upload route names files as "{user.id}-{timestamp}.pdf"
    if (!filename.startsWith(`${userId}-`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const filePath = path.join(DATA_RESUMES_DIR, filename);

    // Prevent path traversal
    if (!filePath.startsWith(DATA_RESUMES_DIR + path.sep) && filePath !== DATA_RESUMES_DIR) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only serve PDFs. Upload route writes "{userId}-{ts}.pdf" — any other
    // extension means the file is not one we issued. Reject early instead of
    // serving as text/html or octet-stream (mitigates XSS via stored HTML
    // and content sniffing).
    const ext = path.extname(filename).toLowerCase();
    if (ext !== ".pdf") {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    const buffer = await readFile(filePath);

    // Verify PDF magic bytes before serving — defense in depth against any
    // non-PDF that may have ended up on disk through a different path.
    if (buffer.length < 4 || buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
      return NextResponse.json(
        { error: "Stored file is not a valid PDF" },
        { status: 500 }
      );
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
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
