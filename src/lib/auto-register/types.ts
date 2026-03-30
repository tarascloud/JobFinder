export type RegistrationStatus =
  | "pending"
  | "in_progress"
  | "registered"
  | "needs_verification"
  | "captcha_required"
  | "phone_required"
  | "already_exists"
  | "failed";

export interface RegistrationResult {
  status: RegistrationStatus;
  message: string;
  requiresManual?: boolean;
  /** Instructions to complete manual steps */
  manualInstructions?: string;
  log: string[];
}

export interface RegistrationContext {
  /** JF email ({slug}@jf.taras.cloud) used as registration email */
  jfEmail: string;
  /** Generated password for the new account (saved encrypted) */
  password: string;
  /** User's real name for profile */
  name?: string | null;
}

export type RegisterFn = (ctx: RegistrationContext) => Promise<RegistrationResult>;

export interface PlatformRegistrationConfig {
  platform: string;
  label: string;
  registrationUrl: string;
  supportsAutoRegister: boolean;
  requiresPhone: boolean;
  requiresCaptcha: boolean;
  requiresEmailVerification: boolean;
  note: string;
}

export const PLATFORM_REGISTRATION_CONFIGS: PlatformRegistrationConfig[] = [
  {
    platform: "linkedin",
    label: "LinkedIn",
    registrationUrl: "https://www.linkedin.com/signup",
    supportsAutoRegister: true,
    requiresPhone: false,
    requiresCaptcha: true,
    requiresEmailVerification: true,
    note: "Registration auto-fills form; email verification required manually",
  },
  {
    platform: "indeed",
    label: "Indeed",
    registrationUrl: "https://secure.indeed.com/account/register",
    supportsAutoRegister: true,
    requiresPhone: false,
    requiresCaptcha: true,
    requiresEmailVerification: true,
    note: "Registration auto-fills form; email verification required manually",
  },
  {
    platform: "glassdoor",
    label: "Glassdoor",
    registrationUrl: "https://www.glassdoor.com/profile/joinGlassdoor.htm",
    supportsAutoRegister: true,
    requiresPhone: false,
    requiresCaptcha: true,
    requiresEmailVerification: true,
    note: "Registration auto-fills form; email verification required manually",
  },
  {
    platform: "wellfound",
    label: "Wellfound",
    registrationUrl: "https://wellfound.com/join",
    supportsAutoRegister: true,
    requiresPhone: false,
    requiresCaptcha: false,
    requiresEmailVerification: true,
    note: "Registration auto-fills form; email verification required manually",
  },
  {
    platform: "djinni",
    label: "Djinni",
    registrationUrl: "https://djinni.co/signup/",
    supportsAutoRegister: true,
    requiresPhone: false,
    requiresCaptcha: false,
    requiresEmailVerification: true,
    note: "Registration auto-fills form; email verification required manually",
  },
  {
    platform: "remoteok",
    label: "RemoteOK",
    registrationUrl: "",
    supportsAutoRegister: false,
    requiresPhone: false,
    requiresCaptcha: false,
    requiresEmailVerification: false,
    note: "No account needed — public scraping only",
  },
  {
    platform: "weworkremotely",
    label: "WeWorkRemotely",
    registrationUrl: "",
    supportsAutoRegister: false,
    requiresPhone: false,
    requiresCaptcha: false,
    requiresEmailVerification: false,
    note: "No account needed — public scraping only",
  },
  {
    platform: "hn-whohiring",
    label: "HN Who's Hiring",
    registrationUrl: "",
    supportsAutoRegister: false,
    requiresPhone: false,
    requiresCaptcha: false,
    requiresEmailVerification: false,
    note: "No account needed — public scraping only",
  },
  {
    platform: "dice",
    label: "Dice",
    registrationUrl: "https://www.dice.com/register",
    supportsAutoRegister: true,
    requiresPhone: false,
    requiresCaptcha: true,
    requiresEmailVerification: true,
    note: "Registration auto-fills form; email verification required manually",
  },
  {
    platform: "ziprecruiter",
    label: "ZipRecruiter",
    registrationUrl: "https://www.ziprecruiter.com/registration",
    supportsAutoRegister: false,
    requiresPhone: true,
    requiresCaptcha: true,
    requiresEmailVerification: true,
    note: "Phone verification required — manual registration needed",
  },
];
