import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-full)] px-2.5 text-[0.6875rem] font-semibold capitalize leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--muted)] text-[var(--muted-foreground)]",
        info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
        success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
        warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
        destructive: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
