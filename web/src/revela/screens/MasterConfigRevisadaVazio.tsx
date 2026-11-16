/* Master-config-revisada--vazio.html (M31.v): nenhum valor lido do servidor. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";
import { CONFIG_CAPTION } from "./MasterConfigRevisada";

export function MasterConfigRevisadaVazio() {
  return <MasterFrame current="configuracoes"><MasterStatePage area="Configurações" variant="empty" caption={CONFIG_CAPTION} title="Configurações indisponíveis" text="Nenhum valor foi lido do servidor." /></MasterFrame>;
}
