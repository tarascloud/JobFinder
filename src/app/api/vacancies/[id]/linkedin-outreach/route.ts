import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { generateLinkedInOutreach } from "@/actions/linkedin-outreach";

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

    const result = await generateLinkedInOutreach(vacancyId);

    if ("error" in result) {
      const status =
        result.error === "Vacancy not found" ? 404 :
        result.error === "Please create your profile first" ? 422 :
        500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[linkedin-outreach] Error:", e);
    return NextResponse.json(
      { error: "Failed to generate LinkedIn outreach" },
      { status: 500 }
    );
  }
}
