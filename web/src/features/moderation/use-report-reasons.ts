"use client";
import { useCallback, useEffect, useState } from "react";
import { listReportReasons, type ReportReasons } from "./report-reasons";

/** Motivos agregados do evento (anfitrião). Fica à parte de report-reasons.ts para o Master (servidor) importar só as funções puras. */
export function useReportReasons(eventId: string, refreshKey?: unknown): ReportReasons {
  const [data, setData] = useState<ReportReasons>({ photos: {}, comments: {} });
  const load = useCallback(async () => {
    try { setData(await listReportReasons(eventId)); } catch { /* sem motivos: a fila continua com as contagens */ }
  }, [eventId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);
  return data;
}
