import type { ComponentProps } from "react";
import { Button as BaseButton, buttonVariants } from "@/components/ui/button";

export const Button = BaseButton;
export { buttonVariants };
export type ButtonProps = ComponentProps<typeof BaseButton>;
