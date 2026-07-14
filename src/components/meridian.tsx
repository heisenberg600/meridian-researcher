import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
  secondary:
    "border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--ink-700)] hover:bg-[var(--ivory-200)] active:bg-[var(--ivory-300)]",
  ghost:
    "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--ivory-200)] hover:text-[var(--ink-700)]",
  danger:
    "border-transparent bg-[var(--status-danger)] text-white hover:bg-[#9A3327] active:bg-[#822B21]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border [font:var(--text-label)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--ivory-200)] disabled:text-[var(--ink-300)]",
        size === "sm" && "h-[var(--control-height-sm)] px-3 text-[0.8125rem]",
        size === "md" && "h-[var(--control-height)] px-4",
        size === "lg" && "h-[var(--control-height-lg)] px-5",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...props }: TextInputProps) {
  return (
    <input
      className={cx(
        "h-[var(--control-height)] w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 [font:var(--text-body)] text-[var(--ink-700)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:shadow-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cx(
        "w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 [font:var(--text-body)] text-[var(--ink-700)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:shadow-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-[var(--ivory-200)] text-[var(--text-secondary)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] items-center rounded-[var(--radius-full)] px-2.5 text-[0.6875rem] font-semibold capitalize leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {children}
    </section>
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
