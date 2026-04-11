import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { generateNegotiationHelper } from "@/actions/negotiation-helper";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
