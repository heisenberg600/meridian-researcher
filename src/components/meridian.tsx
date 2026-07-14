import type { ReactNode } from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Button as ShadcnButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const cx = cn;
export const Button = ShadcnButton;
export const TextInput = Input;
export { Card, Textarea };

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <ShadcnBadge variant={tone === "danger" ? "destructive" : tone} className={className}>
      {children}
    </ShadcnBadge>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 [font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="[font:var(--text-display-md)] tracking-[var(--tracking-display)] text-[var(--text-heading)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl [font:var(--text-body)] text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
