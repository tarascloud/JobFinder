import { registerLinkedIn } from "./linkedin";
import { registerIndeed } from "./indeed";
import { registerGlassdoor } from "./glassdoor";
import { registerWellfound } from "./wellfound";
import { registerDjinni } from "./djinni";
import { registerDice } from "./dice";
import {
  type RegistrationContext,
  type RegistrationResult,
  PLATFORM_REGISTRATION_CONFIGS,
} from "./types";

export { generatePassword } from "./helpers";
export type { RegistrationContext, RegistrationResult, RegistrationStatus } from "./types";
export { PLATFORM_REGISTRATION_CONFIGS } from "./types";

/**
 * Run auto-registration for the given platform.
 * Returns error result if platform is not supported or has no auto-register script.
 */
export async function registerOnPlatform(
  platform: string,
  ctx: RegistrationContext
): Promise<RegistrationResult> {
  switch (platform) {
    case "linkedin":
      return registerLinkedIn(ctx);
    case "indeed":
      return registerIndeed(ctx);
    case "glassdoor":
      return registerGlassdoor(ctx);
    case "wellfound":
      return registerWellfound(ctx);
    case "djinni":
      return registerDjinni(ctx);
    case "dice":
      return registerDice(ctx);
    default: {
      const config = PLATFORM_REGISTRATION_CONFIGS.find(
        (c) => c.platform === platform
      );
      if (config && !config.supportsAutoRegister) {
        return {
          status: "failed",
          message: `${config.label} does not require registration — ${config.note}`,
          log: [`Platform ${platform} does not support auto-registration`],
        };
      }
      return {
        status: "failed",
        message: `Platform "${platform}" is not supported for auto-registration`,
        log: [`Unknown platform: ${platform}`],
      };
    }
  }
}
