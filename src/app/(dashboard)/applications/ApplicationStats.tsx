"use client";

interface PipelineStats {
  queued: number;
  approved: number;
  applied: number;
  interview: number;
  offer: number;
}

interface RateLimitInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface ApplicationStatsProps {
  pipelineStats: PipelineStats;
  rateLimit: RateLimitInfo | null;
  totalItems: number;
  tApplications: (key: string, values?: Record<string, number>) => string;
}

export function ApplicationStats({
  pipelineStats,
  rateLimit,
  totalItems,
  tApplications,
}: ApplicationStatsProps) {
  return (
    <>
      {/* Rate limit header */}
      {rateLimit && (
        <div className="flex items-center gap-2 text-sm">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
            rateLimit.remaining === 0 ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground"
          }`}>
            <GaugeIcon />
            <span className={rateLimit.remaining === 0 ? "font-medium" : ""}>
              {tApplications("rate_limit_status", { used: rateLimit.used, limit: rateLimit.limit })}
            </span>
          </div>
        </div>
      )}

      {/* Pipeline summary stats */}
      {totalItems > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Queued", value: pipelineStats.queued, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
            { label: "Approved", value: pipelineStats.approved, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
            { label: "Applied", value: pipelineStats.applied, color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
            { label: "Interview", value: pipelineStats.interview, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
            { label: "Offer", value: pipelineStats.offer, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border p-3 text-center ${stat.color}`}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider mt-0.5 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GaugeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}
