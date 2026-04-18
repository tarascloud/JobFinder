import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { autoRegisterPlatform } from "@/actions/auto-register";
import { PLATFORM_REGISTRATION_CONFIGS } from "@/lib/auto-register";
import { z } from "zod";

const RegisterSchema = z.object({
  platform: z.string().min(1).max(64),
});

/**
 * POST /api/platforms/register
 * Body: { platform: string }
 *
 * Triggers auto-registration on the specified platform using the user's JF email.
 * Returns the registration result.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;
  if (authResult.user.id === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { platform } = parsed.data;

  const config = PLATFORM_REGISTRATION_CONFIGS.find((c) => c.platform === platform);
  if (!config) {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
  }

  if (!config.supportsAutoRegister) {
    return NextResponse.json(
      { error: `${config.label} does not support auto-registration: ${config.note}` },
      { status: 422 }
    );
  }

  const result = await autoRegisterPlatform(platform);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, result: result.result });
}
