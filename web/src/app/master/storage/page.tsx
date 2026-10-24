import { requireMaster, rpcOr } from "../data";
import { bytes, num, pct } from "@/features/master/format";
import { Lines } from "../analytics/charts";
import { shortDay } from "../analytics/lib";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Meter } from "../kit/Meter";
import { Pill } from "../kit/Pill";
import { StackBar } from "../kit/StackBar";
import { PageHead, StateBox } from "../ui";
import { cumulativeGrowth, daysToQuota, fromBreakdown, fromLegacyMetrics, QUOTA_BYTES, QUOTA_LABEL, segments, type Breakdown } from "./lib";
import styles from "./page.module.css";

export default async function Storage() {
  const sb = await requireMaster();
  const r = await rpcOr<Breakdown>(sb, "admin_storage_breakdown", {}, { name: "admin_dashboard_metrics", map: fromLegacyMetrics });
  const b = r.state === "ok" ? (r.degraded ? r.data : fromBreakdown(r.data)) : null;
  const segs = b ? segments(b) : [];
  const curve = b ? cumulativeGrowth(b.growth, b.totalBytes) : [];
  const eta = b ? daysToQuota(b.growth, b.totalBytes) : null;

  return (
    <>
      <PageHead titulo="Storage e fotos" texto="Ocupação do armazenamento, só leitura. O console não lista nem exibe fotografias privadas; o acesso excepcional exige justificativa e fica na auditoria." />
      {r.state === "ok" && r.degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco. Até lá, as fotos aparecem sem classificação e sem curva de crescimento.</p>}
      {!b ? <StateBox load={r} /> : (
        <>
          <div className={styles.grid}>
            <section className={styles.card}>
              <h2>Uso estimado da cota</h2>
              <Meter label={`Total ocupado contra ${QUOTA_LABEL}`} value={b.totalBytes} max={QUOTA_BYTES}
                valueText={`${bytes(b.totalBytes)} de 1 GB (${pct(b.totalBytes, QUOTA_BYTES, 1)})`} />
              <p className={styles.note}>
                Estimativa: soma dos arquivos de fotos e identidade visual. A cota é a do plano gratuito, não lida do provedor.
                {eta != null && (eta === 0 ? " Cota atingida." : ` No ritmo dos últimos 30 dias, a cota acaba em cerca de ${num(eta)} dias.`)}
              </p>
            </section>
            <section className={styles.card}>
              <h2>Tamanho médio por foto</h2>
              <div className="adm-num">{b.avgPhotoBytes != null ? bytes(b.avgPhotoBytes) : "—"}</div>
              <p className={styles.note}>{b.classified ? "Média dos originais." : "Estimativa: bytes de fotos divididos pelas fotos prontas, inclui miniaturas."}</p>
            </section>
            <section className={styles.card}>
              <h2>Órfãos</h2>
              {b.classified ? (
                <>
                  <div className={styles.row}><span className="adm-num">{num(b.orphans.n)}</span><Pill tone={b.orphans.n > 0 ? "warn" : "ok"}>{b.orphans.n > 0 ? `${bytes(b.orphans.bytes)} sem foto` : "nenhum"}</Pill></div>
                  <p className={styles.note}>Arquivos no bucket sem foto correspondente no banco. Nada é apagado por aqui.</p>
                </>
              ) : <p className={styles.note}>Disponível após a atualização do banco.</p>}
            </section>
          </div>

          <section className={`${styles.card} ${styles.block}`}>
            <h2>Composição</h2>
            <StackBar segments={segs.map((s) => ({ label: s.label, value: s.bytes }))} format={bytes} label={`Composição do armazenamento: ${segs.map((s) => `${s.label} ${bytes(s.bytes)}`).join("; ")}`} />
          </section>

          {b.classified && (curve.length ? (
            <div className={styles.block}>
              <Lines title="Ocupação nos últimos 30 dias" labels={curve.map((g) => shortDay(g.day))} fmt={bytes}
                note="Total acumulado no fim de cada dia (fotos e identidade visual)."
                series={[{ name: "Ocupação", values: curve.map((g) => g.bytes), color: 1 }]} />
            </div>
          ) : <EmptyState title="Sem curva de crescimento" text="Nenhum arquivo entrou nos últimos 30 dias." />)}

          <div className={styles.head}>
            <h2>Detalhe por classe</h2>
            <CsvButton filename="storage-classes" rows={segs.map((s) => ({ classe: s.label, arquivos: s.n, bytes: s.bytes, descricao: s.note }))}
              cols={[{ key: "classe", label: "Classe" }, { key: "arquivos", label: "Arquivos" }, { key: "bytes", label: "Bytes" }, { key: "descricao", label: "Descrição" }]} />
          </div>
          <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Detalhe por classe">
            <table className="adm-table">
              <thead><tr><th scope="col">Classe</th><th scope="col" className="num">Arquivos</th><th scope="col" className="num">Tamanho</th><th scope="col" className="num">Parte</th><th scope="col">O que é</th></tr></thead>
              <tbody>
                {segs.map((s) => (
                  <tr key={s.key}>
                    <th scope="row">{s.label}</th>
                    <td className="num">{num(s.n)}</td>
                    <td className="num">{bytes(s.bytes)}</td>
                    <td className="num">{pct(s.bytes, b.totalBytes)}</td>
                    <td>{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
