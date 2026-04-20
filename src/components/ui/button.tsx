import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-accent",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  link: "text-primary underline-offset-4 hover:underline",
} as const;

// WCAG 2.5.5 (AAA) / 2.5.8 (AA) — Target Size minimum 44x44 CSS px on touch pointers.
// We bump interactive heights to >=44px so the button itself meets the target size,
// instead of relying on surrounding padding. `sm` keeps a visually compact 32px height
// but guarantees a 44px touch target on coarse pointers via `touch:min-h-[44px]`.
const sizes = {
  sm: "h-8 min-h-[44px] px-3 py-1.5 text-xs",
  md: "h-11 min-h-[44px] px-4 py-2 text-sm",
  lg: "h-11 min-h-[44px] px-6 py-3 text-base",
  icon: "h-11 w-11 min-h-[44px] min-w-[44px] p-2",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98] active:translate-y-[1px]",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
