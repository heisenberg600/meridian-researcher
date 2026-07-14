import type { ComponentProps } from "react";
import { Badge as BaseBadge, badgeVariants } from "@/components/ui/badge";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
type BaseBadgeProps = ComponentProps<typeof BaseBadge>;

export type BadgeProps = Omit<BaseBadgeProps, "variant"> & {
  tone?: BadgeTone;
  variant?: BaseBadgeProps["variant"];
};

export function Badge({ tone, variant, ...props }: BadgeProps) {
  const resolvedVariant = variant ?? (tone === "danger" ? "destructive" : tone);
  return <BaseBadge variant={resolvedVariant} {...props} />;
}

export { badgeVariants };
