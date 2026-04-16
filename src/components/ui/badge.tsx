import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-secondary text-secondary-foreground border-transparent",
  secondary: "bg-muted text-muted-foreground border-border",
  outline: "bg-transparent text-foreground border-border",
  destructive:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700/50",
  yellow:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/60 dark:text-yellow-300 dark:border-yellow-700/50",
  blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700/50",
  green:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700/50",
  purple:
    "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-700/50",
  indigo:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-300 dark:border-indigo-700/50",
  emerald:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700/50",
  red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700/50",
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
