/* Master-pessoas-equipe.html (M19) e as folhas M19.f1 (conceder) e M19.f2 (revogar): markup e classes da referência; dados por props (o padrão é o desenho).
   `onGrant` e `onRevoke` só existem na rota real (componente cliente da página); no desenho (/dev/revela) os botões não fazem nada. */
import { MHead, MNote, MTable, MasterFrame } from "../master-kit";
import { GrantButton, PessoasTabs, REF_COUNTS, Status, type TabCounts } from "./MasterPessoasKit";
import { GrantRoleSheet, RevokeRoleSheet } from "./PessoasEquipeSheets";
import { roleTone, type TeamRow } from "@/lib/master/people";

export const EQUIPE_REF: TeamRow[] = [
  { userId: "t1", email: "marcos@revela.app", role: "master", by: "instalação", at: "02 set 2026 10:00", lastMaster: true },
  { userId: "t2", email: "suporte@revela.app", role: "support", by: "marcos@revela.app", at: "10 set 2026 14:22", lastMaster: false },
  { userId: "t3", email: "auditoria@revela.app", role: "auditor", by: "marcos@revela.app", at: "15 set 2026 09:05", lastMaster: false },
];

export interface EquipeViewProps {
  counts?: TabCounts;
  rows?: TeamRow[];
  live?: boolean;
  onGrant?: () => void;
  onRevoke?: (row: TeamRow) => void;
}

function EquipeBody({ counts = REF_COUNTS, rows = EQUIPE_REF, live, onRevoke }: EquipeViewProps) {
  return (
    <>
      <PessoasTabs aba="equipe" counts={counts} live={live} />
      <MTable cols="1.6fr .7fr 1.4fr 1.1fr .7fr" head={["Conta", "Papel", "Concedido por", "Concedido em", ""]}
        rows={rows.map((r) => ({
          key: `${r.userId}-${r.role}`,
          cells: [r.email, <Status key="r" tone={roleTone(r.role)}>{r.role}</Status>, r.by, r.at,
            r.lastMaster ? <span key="l" className="rv-caption">último master</span>
              : <button key="b" type="button" className="rv-btn rv-btn--sm" onClick={onRevoke ? () => onRevoke(r) : undefined}>Revogar</button>],
        }))} />
      <MNote icon="shield">Sempre fica pelo menos um master. Conceder e revogar pedem motivo e entram na auditoria.</MNote>
    </>
  );
}

export function MasterPessoasEquipeView(props: EquipeViewProps) {
  return (
    <>
      <MHead title="Pessoas" caption="Quem tem papel no console"><GrantButton onClick={props.onGrant} /></MHead>
      <EquipeBody {...props} />
    </>
  );
}

export function MasterPessoasEquipe(props: EquipeViewProps = {}) {
  return <MasterFrame current="pessoas"><MasterPessoasEquipeView {...props} /></MasterFrame>;
}

/** M19.f1: a tela esmaecida (`.mdim`) com a folha "Conceder papel" por cima. */
export function MasterPessoasEquipeFolha({ children, ...props }: EquipeViewProps & { children: React.ReactNode }) {
  return (
    <MasterFrame current="pessoas">
      <MHead title="Pessoas" caption="Quem tem papel no console"><GrantButton /></MHead>
      <div className="mdim"><EquipeBody {...props} /></div>
      {children}
    </MasterFrame>
  );
}
export { GrantRoleSheet, RevokeRoleSheet };
