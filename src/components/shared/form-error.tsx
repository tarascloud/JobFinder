import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormErrorProps {
  /** id so inputs can reference the message via aria-describedby */
  id?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Shared form error message.
 * Renders nothing when there is no error; announces via role="alert".
 * Pair with `aria-invalid` + `aria-describedby={id}` on the offending input.
 */
export function FormError({ id, className, children }: FormErrorProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2",
        className,
      )}
    >
      {children}
    </p>
  );
}
