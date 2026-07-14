import { clsx, type ClassValue } from "clsx";
import { ConvexError } from "convex/values";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserFacingConvexError(cause: unknown, fallback: string) {
  if (!(cause instanceof ConvexError)) return fallback;

  if (typeof cause.data === "string") return cause.data;
  if (cause.data && !Array.isArray(cause.data) && typeof cause.data === "object") {
    const message = (cause.data as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}
