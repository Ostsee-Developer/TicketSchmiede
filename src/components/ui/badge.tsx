import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary ring-primary/20",
        secondary: "bg-secondary text-secondary-foreground ring-border",
        destructive: "bg-red-50 text-red-700 ring-red-200",
        success: "bg-green-50 text-green-700 ring-green-200",
        warning: "bg-amber-50 text-amber-700 ring-amber-200",
        info: "bg-blue-50 text-blue-700 ring-blue-200",
        muted: "bg-muted text-muted-foreground ring-border",
        outline: "bg-transparent text-foreground ring-border",
      },
      size: {
        default: "text-xs px-2 py-0.5",
        sm: "text-2xs px-1.5 py-0.5",
        lg: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            variant === "success" && "bg-green-500",
            variant === "destructive" && "bg-red-500",
            variant === "warning" && "bg-amber-500",
            variant === "info" && "bg-blue-500",
            (!variant || variant === "default") && "bg-primary",
            variant === "muted" && "bg-muted-foreground",
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
