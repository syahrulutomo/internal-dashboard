"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  clearCooldown,
  getCooldownUntil,
  getServerCooldownUntil,
  subscribeCooldown,
} from "@/libs/login-cooldown";

// Exposes the live login lockout: whether it's active and how long is left.
// `until` comes from the external store (SSR-safe); a 1s ticker re-renders the
// countdown and tidies storage once it elapses.
export function useLoginCooldown() {
  const until = useSyncExternalStore(
    subscribeCooldown,
    getCooldownUntil,
    getServerCooldownUntil,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const tick = () => {
      if (Date.now() >= until) {
        clearCooldown(); // store emits → until becomes 0, remaining → 0
      }
      setNow(Date.now());
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  const remainingMs = Math.max(0, until - now);
  return { isCoolingDown: remainingMs > 0, remainingMs };
}
