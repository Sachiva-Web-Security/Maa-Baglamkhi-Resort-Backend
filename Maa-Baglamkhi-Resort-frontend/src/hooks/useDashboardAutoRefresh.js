import { useEffect } from "react";

export default function useDashboardAutoRefresh(refresh, intervalMs = 30000) {
  useEffect(() => {
    if (typeof refresh !== "function") return undefined;
    let lastRefreshTime = 0;

    const runRefresh = () => {
      Promise.resolve(refresh(true)).catch((error) => {
        console.error("Dashboard refresh failed", error);
      });
    };

    const throttledRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshTime < 1000) return;
      lastRefreshTime = now;
      runRefresh();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        throttledRefresh();
      }
    };

    const intervalId = globalThis.setInterval(runRefresh, intervalMs);
    globalThis.addEventListener("focus", throttledRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.clearInterval(intervalId);
      globalThis.removeEventListener("focus", throttledRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, refresh]);
}
