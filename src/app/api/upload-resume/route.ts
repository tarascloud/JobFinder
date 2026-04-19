import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/** Persistent data directory — survives Docker rebuilds via volume mount */
const DATA_RESUMES_DIR = path.join(
  process.env.DATA_DIR || "/app/data",
  "resumes"
);

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const user = authResult.user;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum 10MB." },
        { status: 400 }
      );
    }

    await mkdir(DATA_RESUMES_DIR, { recursive: true });

    const timestamp = Date.now();
    const filename = `${user.id}-${timestamp}.pdf`;
    const filepath = path.join(DATA_RESUMES_DIR, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // Serve via API route (not public/ — that's baked into Docker image at build)
    const url = `/api/resumes/${filename}`;

    return NextResponse.json({ url, originalFilename: file.name });
  } catch (e) {
    console.error("Upload resume error:", e);
    return NextResponse.json(
      { error: "Failed to upload resume" },
      { status: 500 }
    );
  }
}
