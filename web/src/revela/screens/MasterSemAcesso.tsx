/* Master-sem-acesso.html (M32): acesso limitado. A matriz e os textos por papel vêm por props; o padrão é o desenho (papel support).
   No app: `MasterAcessoLimitado` mostra a matriz REAL dos papéis (lib/master/roles.ts); quem tem papel vê a M32 ao abrir uma área que o papel não abre,
   quem não tem papel nenhum vê a M32 como página inteira (layout). */
import type { ReactNode } from "react";
import type { PlatformRole } from "@/lib/master/access";
import { ROLE_MATRIX, type Cell, type MatrixRow } from "@/lib/master/roles";
import { Ico, MCard, MasterFrame } from "../master-kit";

export interface SemAcessoProps {
  /** Legenda do cabeçalho (padrão do desenho). */
  caption?: string;
  title?: string;
  text?: string;
  /** Como o papel vê um e-mail (null = a pessoa não vê e-mail algum). */
  emailExample?: string;
  /** Linhas da matriz (padrão: a do desenho). */
  rows?: readonly MatrixRow[];
}

/** A matriz do desenho (proposta). A do app é `ROLE_MATRIX`; a diferença está em DIVERGENCIAS.md. */
export const REF_MATRIX: readonly MatrixRow[] = [
  { label: "Eventos, pessoas e convites", master: "yes", support: "yes", auditor: "yes" },
  { label: "E-mail e contato completos", master: "yes", support: "masked", auditor: "masked" },
  { label: "Pagamentos", master: "yes", support: "read", auditor: "read" },
  { label: "Auditoria", master: "yes", support: "no", auditor: "yes" },
  { label: "Exportar", master: "yes", support: "no", auditor: "yes" },
  { label: "Revelar agora, estornar, excluir", master: "yes", support: "no", auditor: "no" },
  { label: "Preços, cortesias e configurações", master: "yes", support: "no", auditor: "no" },
  { label: "Equipe e papéis", master: "yes", support: "no", auditor: "no" },
  { label: "Nota interna de impressão", master: "yes", support: "no", auditor: "no" },
];

const COLS = "2fr .8fr .8fr .8fr";
function CellView({ v }: { v: Cell }): ReactNode {
  if (v === "yes") return <Ico n="check" />;
  if (v === "masked") return "mascarado";
  if (v === "read") return "leitura";
  return "—";
}

export function MasterSemAcessoView({
  caption = "Esta área é só para master", title = "Seu papel é support",
  text = "Você entra no console para consultar e atender. E-mails aparecem mascarados e as ações sensíveis ficam com o master.",
  emailExample = "a***@email.com", rows = REF_MATRIX,
}: SemAcessoProps) {
  return (
    <>
      <div className="mhead">
        <div>
          <h1 className="rv-title-lg">Acesso limitado</h1>
          <p className="rv-caption" style={{ marginTop: "6px" }}>{caption}</p>
        </div>
        <div className="row" style={{ gap: "8px" }} />
      </div>
      <div className="mgrid2" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
        <MCard>
          <div className="mstate" style={{ padding: "26px 8px" }}>
            <Ico n="lock" />
            <h2 className="rv-title" style={{ fontSize: "20px" }}>{title}</h2>
            <p className="rv-caption">{text}</p>
          </div>
          <div className="rv-group">
            <div className="rv-row">
              <Ico n="mail" />
              <div className="rv-row__text">Como você vê um e-mail<span className="rv-row__meta">{emailExample}</span></div>
            </div>
            <div className="rv-row">
              <Ico n="user" />
              <div className="rv-row__text">Quem pode ampliar seu acesso<span className="rv-row__meta">Um master, em Pessoas › Equipe</span></div>
            </div>
          </div>
        </MCard>
        <MCard style={{ paddingBottom: "8px" }}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>O que cada papel vê</h2>
          <div className="mtable">
            <div className="mtr mth" style={{ gridTemplateColumns: COLS }}><span /><span>master</span><span>support</span><span>auditor</span></div>
            {rows.map((r) => (
              <div className="mtr" style={{ gridTemplateColumns: COLS }} key={r.label}>
                <span>{r.label}</span><span><CellView v={r.master} /></span><span><CellView v={r.support} /></span><span><CellView v={r.auditor} /></span>
              </div>
            ))}
          </div>
        </MCard>
      </div>
    </>
  );
}

/** A tela do desenho (fixture), com a moldura do Master. */
export function MasterSemAcesso(props: SemAcessoProps = {}) {
  return <MasterFrame><MasterSemAcessoView {...props} /></MasterFrame>;
}

const COPY: Record<PlatformRole | "none", { title: string; text: string; email: string }> = {
  master: { title: "Seu papel é master", text: "Você tem acesso a tudo no console.", email: "e-mail completo" },
  support: { title: "Seu papel é support", text: "Você entra no console para consultar e atender. E-mails aparecem mascarados e as ações sensíveis ficam com o master.", email: "a***@email.com" },
  auditor: { title: "Seu papel é auditor", text: "Você entra no console para consultar e auditar. E-mails aparecem mascarados e as ações sensíveis ficam com o master.", email: "a***@email.com" },
  none: { title: "Você não tem papel no console", text: "Esta conta não está na equipe do Revela. O acesso não pode ser concedido por esta tela.", email: "nenhum: sem acesso a e-mails" },
};

/** M32 no app: conteúdo (o layout já traz a moldura). `role` null = conta sem papel de plataforma. */
export function MasterAcessoLimitado({ role, caption }: { role: PlatformRole | null; caption?: string }) {
  const c = COPY[role ?? "none"];
  return <MasterSemAcessoView caption={caption ?? (role ? "Esta área é só para master" : "Acesso restrito à equipe da plataforma")} title={c.title} text={c.text} emailExample={c.email} rows={ROLE_MATRIX} />;
}
