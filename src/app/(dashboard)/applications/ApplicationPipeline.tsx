"use client";

interface PipelineStats {
  queued: number;
  approved: number;
  applied: number;
  interview: number;
  offer: number;
}

interface ApplicationPipelineProps {
  stats: PipelineStats;
}

export function ApplicationPipeline({ stats }: ApplicationPipelineProps) {
  const items = [
    { label: "Queued", value: stats.queued, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
    { label: "Approved", value: stats.approved, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
    { label: "Applied", value: stats.applied, color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
    { label: "Interview", value: stats.interview, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
    { label: "Offer", value: stats.offer, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {items.map(stat => (
        <div key={stat.label} className={`rounded-xl border p-3 text-center ${stat.color}`}>
          <p className="text-2xl font-bold">{stat.value}</p>
          <p className="text-[11px] font-medium uppercase tracking-wider mt-0.5 opacity-80">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
