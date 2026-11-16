/* Master-pessoas-equipe--folha-revogar.html (M19.f2): folha "Revogar o papel de support?" sobre a tela da Equipe, com os dados do desenho. */
import { MasterPessoasEquipeFolha } from "./MasterPessoasEquipe";
import { RevokeRoleSheet } from "./PessoasEquipeSheets";

export function MasterPessoasEquipeFolhaRevogar() {
  return (
    <MasterPessoasEquipeFolha>
      <RevokeRoleSheet inline role="support" email="suporte@revela.app" initialReason="Saiu da equipe de atendimento em 11 de novembro." />
    </MasterPessoasEquipeFolha>
  );
}
