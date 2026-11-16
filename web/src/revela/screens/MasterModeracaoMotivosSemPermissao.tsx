/* Master-moderacao-motivos--*.html (M26): estado "denied". A tela está em MasterModeracaoMotivos.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterModeracaoMotivosEstado } from "./MasterModeracaoMotivos";
export function MasterModeracaoMotivosSemPermissao() {
  return <MasterFrame current="moderacao"><MasterModeracaoMotivosEstado variant="denied" /></MasterFrame>;
}
