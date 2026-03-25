import { type ApplyContext, type ApplyResult } from "./types";
import { applyLinkedIn } from "./linkedin";
import { applyIndeed } from "./indeed";
import { applyGeneric } from "./generic";

export type { ApplyContext, ApplyResult } from "./types";

export async function applyToVacancy(
  ctx: ApplyContext,
  platformCredentials: { email: string; password: string }
): Promise<ApplyResult> {
  switch (ctx.vacancy.platform) {
    case "linkedin":
      return applyLinkedIn(ctx, platformCredentials);
    case "indeed":
      return applyIndeed(ctx, platformCredentials);
    default:
      return applyGeneric(ctx);
  }
}
