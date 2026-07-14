import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type SVGProps } from "react";
import { cn } from "@/lib/utils";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  children: ReactElement<SVGProps<SVGSVGElement>>;
  label: string;
  tone?: "default" | "danger";
};

export function IconButton({ children, className, label, tone = "default", type = "button", ...props }: IconButtonProps) {
  const icon = isValidElement(children) ? cloneElement(children, { "aria-hidden": true, focusable: false }) : children;

  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-transparent outline-none transition-[background-color,color,border-color] duration-[var(--duration-fast)] focus-visible:shadow-[var(--focus-ring)] [&_svg]:size-4",
        tone === "danger"
          ? "text-[var(--danger)] hover:border-[var(--danger-line)] hover:bg-[var(--danger-soft)]"
          : "text-[var(--ink-muted)] hover:border-[var(--line)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink-strong)]",
        className,
      )}
      type={type}
      {...props}
    >
      {icon}
    </button>
  );
}
