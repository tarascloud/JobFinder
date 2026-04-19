import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { generateResumePdf } from "@/actions/generate-resume-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const vacancyId = parseInt(id, 10);
    if (isNaN(vacancyId)) {
      return NextResponse.json({ error: "Invalid vacancy ID" }, { status: 400 });
    }

    const result = await generateResumePdf(vacancyId);

    if (!Buffer.isBuffer(result)) {
      const status =
        result.error === "Vacancy not found"
          ? 404
          : result.error === "Please create your profile first"
            ? 422
            : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    const filename = `resume-vacancy-${vacancyId}.pdf`;

    return new NextResponse(result.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(result.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[resume-pdf] Error:", e);
    return NextResponse.json(
      { error: "Failed to generate resume PDF" },
      { status: 500 }
    );
  }
}
