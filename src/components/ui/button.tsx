import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border [font:var(--text-label)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] outline-none focus-visible:border-[var(--ring)] focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:border-transparent disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
        secondary:
          "border-[var(--border-strong)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)] active:bg-[var(--ivory-300)]",
        outline:
          "border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]",
        ghost:
          "border-transparent bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        destructive:
          "border-transparent bg-[var(--destructive)] text-white hover:bg-[var(--red-700)] active:bg-[var(--red-800)]",
      },
      size: {
        sm: "h-[var(--control-height-sm)] px-3 text-[0.8125rem] [&_svg]:size-3.5",
        default: "h-[var(--control-height)] px-4 [&_svg]:size-4",
        lg: "h-[var(--control-height-lg)] px-5 [&_svg]:size-4",
        icon: "size-[var(--control-height)] [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp data-slot="button" type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
