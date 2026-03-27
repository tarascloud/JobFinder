import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-secondary text-secondary-foreground border-transparent",
  secondary: "bg-muted text-muted-foreground border-border",
  outline: "bg-transparent text-foreground border-border",
  destructive: "bg-red-900/60 text-red-300 border-red-700/50",
  yellow: "bg-yellow-900/60 text-yellow-300 border-yellow-700/50",
  blue: "bg-blue-900/60 text-blue-300 border-blue-700/50",
  green: "bg-green-900/60 text-green-300 border-green-700/50",
  purple: "bg-purple-900/60 text-purple-300 border-purple-700/50",
  indigo: "bg-indigo-900/60 text-indigo-300 border-indigo-700/50",
  emerald: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
  red: "bg-red-900/60 text-red-300 border-red-700/50",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
  /** @deprecated Use variant instead */
  color?: keyof typeof variants;
}

export function Badge({ className, variant, color, ...props }: BadgeProps) {
  const v = variant ?? color ?? "default";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[v],
        className
      )}
      {...props}
    />
  );
}
