import { useCallback, useEffect, useState } from "react";

import type { LoadState } from "./contracts";

export function useAdapterResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await load() });
    } catch (cause) {
      setState({
        status: "error",
        message: cause instanceof Error ? cause.message : "Something went wrong. Try again.",
      });
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload, setState };
}
