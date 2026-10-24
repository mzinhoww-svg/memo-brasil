import { brl, num } from "@/features/master/format";
import { planLabel, type CatalogPlan } from "@/features/master/plan";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { REVEAL_TONE, roleLabel, STATUS_TONE, when, type EventDetail } from "./lib";
import css from "./page.module.css";

/** Conteúdo do drawer de evento (servidor). Sem fotos, códigos ou tokens. */
export function EventDrawerBody({ d, catalog, degraded }: { d: EventDetail; catalog: readonly CatalogPlan[]; degraded: boolean }) {
  const e = d.event;
  const plan = planLabel(e.capacity, d.entitlement?.planCode ?? e.planCode, catalog);
  return (
    <>
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco.</p>}
      <section className={css.section} aria-labelledby="dr-dados">
        <h3 id="dr-dados">Dados</h3>
        <dl className={css.dl}>
          <dt>Situação</dt><dd><Pill tone={STATUS_TONE[e.status] ?? "dim"}>{e.status}</Pill>{e.isTest && <> <Pill tone="info">TESTE</Pill></>}</dd>
          <dt>Anfitrião</dt><dd>{e.hostName || <Pill tone="crit">sem anfitrião</Pill>}</dd>
          {e.category && <><dt>Categoria</dt><dd>{e.category}</dd></>}
          <dt>Início</dt><dd>{when(e.startAt)}</dd>
          {e.endAt && <><dt>Fim</dt><dd>{when(e.endAt)}</dd></>}
          <dt>Criado em</dt><dd>{when(e.createdAt)}</dd>
          <dt>Revelação</dt><dd><Pill tone={REVEAL_TONE[e.revealState] ?? "dim"}>{e.revealState}</Pill> {e.revealAt && <span className={css.muted}>{when(e.revealAt)}</span>}</dd>
          <dt>Convidados</dt><dd>{num(e.participants)}{e.capacity ? ` / ${num(e.capacity)}` : ""}</dd>
          <dt>Fotos</dt><dd>{num(e.photos)}{e.failedUploads ? ` (${num(e.failedUploads)} falhas)` : ""}</dd>
          {e.deletedAt && <><dt>Excluído em</dt><dd>{when(e.deletedAt)}</dd></>}
          <dt>ID</dt><dd><code>{e.id}</code></dd>
        </dl>
      </section>
      <section className={css.section} aria-labelledby="dr-plano">
        <h3 id="dr-plano">Plano e direito</h3>
        <dl className={css.dl}>
          <dt>Plano</dt><dd>{plan}</dd>
          {d.entitlement && <>
            <dt>Convidados</dt><dd>{d.entitlement.maxGuests == null ? "sem limite" : num(d.entitlement.maxGuests)}</dd>
            <dt>Fotos por pessoa</dt><dd>{d.entitlement.maxShots == null ? "sem limite" : num(d.entitlement.maxShots)}</dd>
            <dt>Origem</dt><dd>{d.entitlement.source ?? "—"}</dd>
          </>}
        </dl>
      </section>
      {!degraded && <>
        <section className={css.section} aria-labelledby="dr-tempo">
          <h3 id="dr-tempo">Linha do tempo</h3>
          {d.timeline.length ? (
            <ol className={css.list}>{d.timeline.map((t, i) => <li key={i}><span>{t.label}</span><span className={css.muted}>{when(t.at)}</span></li>)}</ol>
          ) : <EmptyState title="Sem marcos registrados" />}
        </section>
        <section className={css.section} aria-labelledby="dr-part">
          <h3 id="dr-part">Participantes ({num(d.participants.length)})</h3>
          {d.participants.length ? (
            <ul className={css.list}>{d.participants.map((p, i) => <li key={i}><span>{p.name || "Sem nome"}{p.isHost && <> <Pill tone="info">anfitrião</Pill></>}</span><span className={css.muted}>{when(p.joinedAt)}</span></li>)}</ul>
          ) : <EmptyState title="Ninguém entrou ainda" text="O convite do evento ainda não foi usado." />}
        </section>
        <section className={css.section} aria-labelledby="dr-ped">
          <h3 id="dr-ped">Pedidos</h3>
          {d.orders.length ? (
            <ul className={css.list}>{d.orders.map((o) => <li key={o.id}><span><Pill tone={o.status === "pago" ? "ok" : o.status === "falhou" ? "crit" : "dim"}>{o.status}</Pill> {brl(o.amountCents)}</span><span className={css.muted}>{when(o.createdAt)}</span></li>)}</ul>
          ) : <EmptyState title="Nenhum pedido" text="Pedidos aparecem só para o papel master." />}
        </section>
        <section className={css.section} aria-labelledby="dr-aud">
          <h3 id="dr-aud">Auditoria do evento</h3>
          {d.audit.length ? (
            <ul className={css.list}>{d.audit.map((a, i) => <li key={i}><span><code>{a.action}</code> <span className={css.muted}>por {roleLabel(a.actorRole)}</span>{a.reason && <span className={css.muted}> · {a.reason}</span>}</span><span className={css.muted}>{when(a.at)}</span></li>)}</ul>
          ) : <EmptyState title="Sem registros de auditoria" />}
        </section>
      </>}
    </>
  );
}
