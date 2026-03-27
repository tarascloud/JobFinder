/** All platforms from the scrapers index — single source of truth */
export const ALL_PLATFORMS = [
  "linkedin",
  "indeed",
  "remoteok",
  "weworkremotely",
  "glassdoor",
  "wellfound",
  "hn-whohiring",
  "djinni",
  "dou",
  "workua",
  "robotaua",
  "dice",
  "simplyhired",
  "arcdev",
  "himalayas",
  "infojobs",
  "tecnoempleo",
  "jobatus",
  "computrabajo",
  "ziprecruiter",
  "nodesk",
  "relocateme",
  "4dayweek",
  "euroremotejobs",
] as const;

export type PlatformName = (typeof ALL_PLATFORMS)[number];

export type PlatformMeta = {
  requiresAuth: boolean;
  reliability: "reliable" | "moderate" | "unreliable" | "defunct";
  registrationUrl?: string;
  note: string;
};

export type PlatformStatus = {
  platform: string;
  status: string;
  lastCheck: string | null;
  message: string;
  vacancyCount?: number;
};
