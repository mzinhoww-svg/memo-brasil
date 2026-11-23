"use client";

import { useEffect, useState } from "react";

/** Milissegundos que restam até `expiresAtMs` no relógio do servidor (aparelho + diferença). Atualiza a cada segundo; para em zero. */
export function useCountdown(expiresAtMs: number | null, clockOffsetMs = 0): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAtMs === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [expiresAtMs]);
  return expiresAtMs === null ? 0 : Math.max(0, expiresAtMs - (now + clockOffsetMs));
}
