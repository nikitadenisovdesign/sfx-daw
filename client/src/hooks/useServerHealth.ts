// Поллит /health каждые 5 сек, обновляет UI store.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthStatus } from "@/types";
import { useUIStore } from "@/store/uiStore";

export function useServerHealth(intervalMs = 5000): HealthStatus | null {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const setServerHealthy = useUIStore((s) => s.setServerHealthy);

  useEffect(() => {
    let cancelled = false;
    const check = async (): Promise<void> => {
      try {
        const h = await api.health();
        if (cancelled) return;
        setHealth(h);
        setServerHealthy(h.status === "ok", h.status === "loading");
      } catch {
        if (cancelled) return;
        setHealth(null);
        setServerHealthy(false, false);
      }
    };
    void check();
    const id = setInterval(check, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs, setServerHealthy]);

  return health;
}
