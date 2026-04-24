import type { ReactNode, ElementType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Lucide icon component to render above the title */
  icon?: ElementType;
  /** Main heading text */
  title: string;
  /** Supporting description text */
  description?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Additional class names for the wrapper */
  className?: string;
  /** Optional children rendered below the description */
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-4",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href}>
              <Button variant="default">{action.label}</Button>
            </Link>
          ) : (
            <Button variant="default" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
