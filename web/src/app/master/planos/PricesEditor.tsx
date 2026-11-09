"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, brl, parseBrl, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";
import { FIELD_LABEL, IMPACT_TEXT, diffPlans, draftErrors, setHighlight, showValue, slugify, toChanges, type PlanRow } from "../prices";

type Env = "sandbox" | "production";

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <input type="checkbox" role="switch" aria-label={label} className="adm-switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
}

/** Prévia do paywall como o anfitrião vê, já com os valores ainda não publicados. */
export function PaywallPreview({ plans, env }: { plans: PlanRow[]; env: Env }) {
  const visible = plans.filter((p) => p.isFree || (env === "sandbox" ? p.sandboxActive : p.productionActive)).sort((a, b) => a.sort - b.sort);
  const chosen = visible.find((p) => p.highlighted) ?? visible[visible.length > 1 ? 1 : 0];
  return (
    <div className="adm-phone" aria-label="Prévia do paywall no celular" role="group">
      <div className="adm-phone__screen">
        <h3 className="rv-title">Escolha o plano</h3>
        <p className="rv-caption">Pague uma vez por evento. Sem assinatura.</p>
        <div className="adm-phone__plans">
          {visible.map((p) => (
            <div key={p.code} className={`rv-plan ${p.code === chosen?.code ? "rv-plan--on" : ""}`}>
              <span className="rv-plan__tier">{p.name}{p.highlighted ? " · destaque" : ""}</span>
              <span className="rv-plan__price">{brl(p.priceCents)}</span>
              <span className="rv-plan__note">{p.maxGuests == null ? "convidados sem limite" : `${p.maxGuests} convidados`}<br />{p.maxShots == null ? "poses livres" : `${p.maxShots} poses cada`}</span>
            </div>
          ))}
        </div>
        <span className="rv-btn rv-btn--cta rv-btn--bloco" aria-hidden="true">Continuar{chosen ? ` · ${brl(chosen.priceCents)}` : ""}</span>
      </div>
    </div>
  );
}

type Stage = "form" | "totp";

/** M04: confirma de → para, mostra o impacto e exige o código do autenticador (TOTP, segundo fator) antes de publicar. */
function ConfirmSheet({ original, draft, onClose, onDone }: { original: PlanRow[]; draft: PlanRow[]; onClose: () => void; onDone: () => void }) {
  const diffs = useMemo(() => diffPlans(original, draft), [original, draft]);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const codeId = useId();
  const rErr = tried ? reasonError(reason) : null;
  const cErr = tried && !/^\d{6}$/.test(code) ? "Digite os 6 números do aplicativo autenticador." : null;

  async function verifyTotp(): Promise<boolean> {
    const mfa = browserSupabase().auth.mfa;
    const list = await mfa.listFactors();
    let factorId = list.data?.totp.find((f) => f.status === "verified")?.id;
    if (!factorId) {
      // primeiro uso: cadastra o autenticador e confirma com o primeiro código
      const pending = enroll ?? await (async () => {
        const r = await mfa.enroll({ factorType: "totp", friendlyName: "Revela Master" });
        if (r.error || !r.data) return null;
        const e = { factorId: r.data.id, uri: r.data.totp.uri, secret: r.data.totp.secret };
        setEnroll(e);
        return e;
      })();
      if (!pending) { setError("Não foi possível preparar o autenticador."); return false; }
      if (!enroll) { setStage("totp"); setError("Cadastre o autenticador com a chave abaixo e digite o primeiro código."); return false; }
      factorId = pending.factorId;
    }
    const ch = await mfa.challenge({ factorId });
    if (ch.error || !ch.data) { setError("Não foi possível validar o código. Tente de novo."); return false; }
    const v = await mfa.verify({ factorId, challengeId: ch.data.id, code });
    if (v.error) { setError("Código incorreto ou expirado."); return false; }
    return true;
  }

  async function publish() {
    setTried(true);
    if (reasonError(reason) || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError(null);
    try {
      if (!(await verifyTotp())) return;
      const { error: err } = await browserSupabase().rpc("admin_publish_plans", { p_changes: toChanges(original, draft), p_reason: reason.trim() });
      if (err) { setError(err.code === "MM016" ? "A sessão não passou pela confirmação em duas etapas. Tente de novo." : adminErrorText(err.code, err.message)); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <Sheet title="Confirmar novos preços" onClose={onClose}>
      <ul className="adm-diff" aria-label="O que muda">
        {diffs.map((d) => (
          <li key={d.code}>
            <strong>{d.name}{d.isNew ? " (plano novo)" : ""}</strong>
            <ul>
              {d.changes.filter((c) => d.isNew ? ["priceCents", "maxGuests", "maxShots"].includes(c.field) : true).map((c) => (
                <li key={c.field}>{FIELD_LABEL[c.field]}: {d.isNew ? "" : <><s>{showValue(c.field, c.from)}</s> → </>}<b>{showValue(c.field, c.to)}</b></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="adm-nota adm-sheet-nota">{IMPACT_TEXT}</p>
      <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={rErr} />
      {enroll && (
        <div className="adm-code-card">
          <p className="adm-nota">Adicione ao seu aplicativo autenticador esta chave (ou abra o link no celular):</p>
          <code aria-label="Chave do autenticador">{enroll.secret}</code>
          <a href={enroll.uri} className="rv-link">Abrir no autenticador</a>
        </div>
      )}
      <div className="rv-field">
        <label className="rv-field-label" htmlFor={codeId}>Código do autenticador</label>
        <input id={codeId} className="rv-field-input rv-field-input--codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          aria-invalid={cErr ? true : undefined} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        {cErr && <span className="rv-field-erro">{cErr}</span>}
      </div>
      {error && <p className="rv-field-erro" role="alert">{error}</p>}
      <Button block onClick={() => void publish()} disabled={busy || (stage === "totp" && !enroll)}>{busy ? "Publicando…" : "Publicar preços"}</Button>
      <Button variant="texto" block onClick={onClose}>Voltar e revisar</Button>
    </Sheet>
  );
}

export function PricesEditor({ plans, env }: { plans: PlanRow[]; env: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PlanRow[]>(plans);
  const [open, setOpen] = useState(false);
  const [previewEnv, setPreviewEnv] = useState<Env>(env === "production" ? "production" : "sandbox");
  const diffs = useMemo(() => diffPlans(plans, draft), [plans, draft]);
  const errors = useMemo(() => draftErrors(draft), [draft]);
  const blocked = Object.keys(errors).length > 0;
  const set = (code: string, patch: Partial<PlanRow>) => setDraft((d) => d.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  const num = (v: string): number | null => (v.trim() === "" ? null : Number.parseInt(v, 10) || 0);
  function addPlan() {
    const n = draft.filter((p) => p.isNew).length + 1;
    const name = `Novo plano ${n}`;
    setDraft((d) => [...d, { code: slugify(name), name, maxGuests: 50, maxShots: 24, priceCents: 5900, sandboxActive: true, productionActive: false, highlighted: false, isFree: false, sort: Math.max(...d.map((p) => p.sort)) + 1, isNew: true }]);
  }

  return (
    <div className="adm-prices">
      <div className="adm-prices__table">
        {diffs.length > 0 && (
          <div className="adm-unpublished" role="status">
            <span><strong>{diffs.length} {diffs.length === 1 ? "plano com alteração" : "planos com alterações"}</strong> não publicadas</span>
            <span className="adm-unpublished__actions">
              <Button variant="texto" small onClick={() => setDraft(plans)}>Descartar</Button>
              <Button small disabled={blocked} onClick={() => setOpen(true)}>Publicar preços</Button>
            </span>
          </div>
        )}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <caption className="rv-sr-only">Planos e preços (edite e publique)</caption>
            <thead><tr><th>Plano</th><th className="num">Preço (R$)</th><th className="num">Convidados</th><th className="num">Poses</th><th>Sandbox</th><th>Produção</th><th>Destacar</th></tr></thead>
            <tbody>
              {draft.map((p) => (
                <tr key={p.code} data-changed={diffs.some((d) => d.code === p.code) || undefined}>
                  <td>
                    {p.isNew ? <input className="rv-field-input adm-cell" aria-label={`Nome do plano ${p.code}`} value={p.name} onChange={(e) => setDraft((d) => d.map((x) => x.code === p.code ? { ...x, name: e.target.value, code: slugify(e.target.value) || x.code } : x))} /> : <strong>{p.name}</strong>}
                    {errors[p.code] && <div className="rv-field-erro" role="alert">{errors[p.code]}</div>}
                  </td>
                  <td className="num">
                    <input className="rv-field-input adm-cell num" aria-label={`Preço de ${p.name}`} inputMode="decimal" disabled={p.isFree} defaultValue={(p.priceCents / 100).toFixed(2).replace(".", ",")}
                      onBlur={(e) => { const c = parseBrl(e.target.value); if (c != null) set(p.code, { priceCents: c }); else e.target.value = (p.priceCents / 100).toFixed(2).replace(".", ","); }} />
                  </td>
                  <td className="num"><input className="rv-field-input adm-cell num" aria-label={`Convidados de ${p.name}`} inputMode="numeric" placeholder="sem limite" value={p.maxGuests ?? ""} onChange={(e) => set(p.code, { maxGuests: num(e.target.value) })} /></td>
                  <td className="num"><input className="rv-field-input adm-cell num" aria-label={`Poses de ${p.name}`} inputMode="numeric" placeholder="livre" value={p.maxShots ?? ""} onChange={(e) => set(p.code, { maxShots: num(e.target.value) })} /></td>
                  <td><Toggle label={`Sandbox de ${p.name}`} checked={p.sandboxActive} disabled={p.isFree} onChange={(v) => set(p.code, { sandboxActive: v })} /></td>
                  <td><Toggle label={`Produção de ${p.name}`} checked={p.productionActive} disabled={p.isFree} onChange={(v) => set(p.code, { productionActive: v })} /></td>
                  <td><input type="radio" name="destaque" className="adm-radio" aria-label={`Destacar ${p.name}`} checked={p.highlighted} disabled={p.isFree} onChange={() => setDraft((d) => setHighlight(d, p.code))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors["_destaque"] && <p className="rv-field-erro" role="alert">{errors["_destaque"]}</p>}
        <div className="adm-prices__foot">
          <Button variant="secundario" small onClick={addPlan}>Novo plano</Button>
          <Button variant="texto" small disabled={!draft.some((p) => p.highlighted)} onClick={() => setDraft((d) => setHighlight(d, null))}>Remover destaque</Button>
        </div>
      </div>
      <aside className="adm-prices__preview" aria-label="Prévia do paywall">
        <div className="rv-chips" role="group" aria-label="Ambiente da prévia">
          {(["sandbox", "production"] as const).map((e) => <button key={e} type="button" className="rv-chip" aria-pressed={previewEnv === e} onClick={() => setPreviewEnv(e)}>{e === "sandbox" ? "Sandbox" : "Produção"}</button>)}
        </div>
        <PaywallPreview plans={draft} env={previewEnv} />
      </aside>
      {open && <ConfirmSheet original={plans} draft={draft} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
    </div>
  );
}
