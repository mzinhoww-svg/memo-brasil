/* Master-moderacao-motivos--*.html (M26): estado "loading". A tela está em MasterModeracaoMotivos.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterModeracaoMotivosEstado } from "./MasterModeracaoMotivos";
export function MasterModeracaoMotivosCarregando() {
  return <MasterFrame current="moderacao"><MasterModeracaoMotivosEstado variant="loading" /></MasterFrame>;
}
