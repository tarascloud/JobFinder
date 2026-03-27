export const QA_CATEGORIES = [
  "linkedin_apply",
] as const;

export type QACategory = (typeof QA_CATEGORIES)[number];
