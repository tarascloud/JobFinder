import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { generateNegotiationHelper } from "@/actions/negotiation-helper";

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

    const result = await generateNegotiationHelper(vacancyId);

    if ("error" in result) {
      const status =
        result.error === "Vacancy not found"
          ? 404
          : result.error === "Please create your profile first"
            ? 422
            : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[negotiation] Error:", e);
    return NextResponse.json(
      { error: "Failed to generate negotiation helper" },
      { status: 500 }
    );
  }
}
