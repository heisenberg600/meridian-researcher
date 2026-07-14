import type { ReactNode } from "react";

export function ToastRegion({ children }: { children?: ReactNode }) {
  return (
    <div aria-live="polite" aria-relevant="additions text" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96">
      {children}
    </div>
  );
}
