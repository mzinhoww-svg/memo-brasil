/* Master-config-revisada--carregando.html (M31.c): 8 linhas × 3 colunas de esqueleto. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";

export function MasterConfigRevisadaCarregando() {
  return <MasterFrame current="configuracoes"><MasterStatePage area="Configurações" variant="loading" cols={3} rows={8} /></MasterFrame>;
}
