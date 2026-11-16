/* Master-cortesias.html (M07): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { Ico, MCard, MHead, MRow, MTable, MasterFrame, St, type Tone } from "../master-kit";

export interface CortesiaRow { key: string; code: string; plan: string; uses: string; validity: string; tone: Tone; status: string; action?: ReactNode }
export interface CortesiasProps {
  caption?: string;
  rows?: CortesiaRow[];
  /** Conteúdo do cartão "Novo código" (o desenho traz campos fixos). */
  form?: ReactNode;
  /** Botões do cabeçalho (vazio no desenho). */
  actions?: ReactNode;
  empty?: string;
}

const REF_ROWS: CortesiaRow[] = [
  { key: "1", code: "NOIVOS-VJ26", plan: "Casamento", uses: "3 de 10", validity: "31 dez 2026", tone: "ok", status: "Ativo" },
  { key: "2", code: "PARCEIRO-CBA", plan: "Celebração", uses: "12 de 50", validity: "30 jun 2027", tone: "ok", status: "Ativo" },
  { key: "3", code: "INFLU-BIA", plan: "Grande", uses: "1 de 1", validity: "—", tone: "info", status: "Esgotado" },
  { key: "4", code: "TESTE-INTERNO", plan: "Festa", uses: "0 de 5", validity: "05 nov 2026", tone: "bad", status: "Vencido" },
];

function RefForm() {
  return (
    <div className="stack" style={{ marginTop: "14px" }}>
      <label className="rv-field"><Ico n="ticket" /><input defaultValue="BUFFET-JARDIM" aria-label="Código" /></label>
      <label className="rv-field"><Ico n="tag" /><input defaultValue="Casamento · 250 convidados" aria-label="Plano" /></label>
      <div className="row" style={{ gap: "8px" }}>
        <label className="rv-field" style={{ flex: "1" }}><input defaultValue="20 usos" aria-label="Usos" /></label>
        <label className="rv-field" style={{ flex: "1" }}><input defaultValue="31/03/2027" aria-label="Validade" /></label>
      </div>
      <button className="rv-btn rv-btn--block rv-btn--primary">Criar código</button>
    </div>
  );
}

export function MasterCortesiasView({ caption = "Códigos que liberam um plano sem pagamento", rows = REF_ROWS, form = <RefForm />, actions, empty }: CortesiasProps = {}) {
  const withAction = rows.some((r) => r.action);
  const mrows: MRow[] = rows.map((r) => ({ key: r.key, cells: [r.code, r.plan, r.uses, r.validity, <St key="s" tone={r.tone}>{r.status}</St>, ...(withAction ? [r.action] : [])] }));
  return (
    <>
      <MHead title="Cortesias" caption={caption}>{actions}</MHead>
      <div className="mgrid2" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <MCard style={{ padding: "0" }}>
          <MTable cols={withAction ? "1.2fr 1fr .8fr 1fr .8fr .6fr" : "1.2fr 1fr .8fr 1fr .8fr"} head={["Código", "Plano", "Usos", "Validade", "Situação", ...(withAction ? [""] : [])]} rows={mrows} empty={empty ?? "Nenhum código gerado ainda."} />
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Novo código</h2>
          {form}
        </MCard>
      </div>
    </>
  );
}

export function MasterCortesias(props: CortesiasProps = {}) {
  return <MasterFrame current="cortesias"><MasterCortesiasView {...props} /></MasterFrame>;
}
