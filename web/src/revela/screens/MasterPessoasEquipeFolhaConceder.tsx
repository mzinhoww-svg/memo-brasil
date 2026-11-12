/* Master-pessoas-equipe--folha-conceder.html (M19.f1): folha "Conceder papel" sobre a tela da Equipe, com os dados do desenho. */
import { MasterPessoasEquipeFolha } from "./MasterPessoasEquipe";
import { GrantRoleSheet } from "./PessoasEquipeSheets";

export function MasterPessoasEquipeFolhaConceder() {
  return (
    <MasterPessoasEquipeFolha>
      <GrantRoleSheet inline initialEmail="financeiro@revela.app" initialRole="support" initialReason="Nova pessoa do atendimento, começa a cobrir os chamados em novembro." />
    </MasterPessoasEquipeFolha>
  );
}
