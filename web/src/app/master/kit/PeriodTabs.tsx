import Link from "next/link";
import { PERIODS, periodDays, type SearchParams } from "@/features/master/params";
import { hrefWith } from "./url";

/** Abas 7 / 30 / 90 dias via `?dias=`; preserva os demais parâmetros. */
export function PeriodTabs({ path, params }: { path: string; params: SearchParams }) {
  const atual = periodDays(params);
  return (
    <nav className="adm-tabs" aria-label="Período">
      {PERIODS.map((d) => <Link key={d} className="adm-btn" href={hrefWith(path, params, { dias: String(d) })} aria-current={d === atual ? "page" : undefined}>{d} dias</Link>)}
    </nav>
  );
}
