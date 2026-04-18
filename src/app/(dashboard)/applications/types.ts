export type AppStatus = "queued" | "approved" | "applied" | "applied_manual" | "response" | "interview" | "offer" | "rejected" | "withdrawn" | "pending_qa" | "failed";

export const statusColors: Record<string, "yellow" | "blue" | "green" | "purple" | "indigo" | "red"> = {
  queued: "yellow",
  approved: "blue",
  applied: "green",
  applied_manual: "green",
  response: "purple",
  interview: "indigo",
  offer: "green",
  rejected: "red",
  withdrawn: "red",
  pending_qa: "yellow",
  failed: "red",
};

export const statusKeys: Record<string, string> = {
  queued: "status_queued",
  approved: "status_approved",
  applied: "status_applied",
  applied_manual: "status_applied_manual",
  response: "status_response",
  interview: "status_interview",
  offer: "status_offer",
  rejected: "status_rejected",
  withdrawn: "status_rejected",
  pending_qa: "status_pending_qa",
  failed: "status_failed",
};

export interface QueueItem {
  id: number;
  vacancyId: number;
  status: string;
  coverLetter: string | null;
  createdAt: Date;
  matchScore: number | null;
  vacancy: {
    id: number;
    title: string;
    company: string | null;
    platform: string;
    url: string;
    location: string | null;
    remoteType: string | null;
    salaryText: string | null;
  };
  searchProfile: {
    id: number;
    name: string;
  };
}

export interface ApplicationItem {
  id: number;
  status: string;
  coverLetter: string | null;
  appliedAt: Date | null;
  appliedWithPersonalAccount: boolean;
  createdAt: Date;
  errorMessage: string | null;
  applyLog: string | null;
  vacancy: {
    id: number;
    title: string;
    company: string | null;
    platform: string;
    url: string;
    location: string | null;
    remoteType: string | null;
    salaryText: string | null;
  };
  searchProfile: {
    id: number;
    name: string;
  };
}

export interface RateLimitInfo {
  used: number;
  limit: number;
  remaining: number;
}

export function scoreColor(score: number | null): string {
  if (!score) return "text-muted-foreground";
  if (score >= 90) return "text-green-400";
  if (score >= 75) return "text-primary";
  return "text-muted-foreground";
}
