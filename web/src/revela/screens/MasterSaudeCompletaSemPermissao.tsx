/* Master-saude-completa--*.html (M27): estado "denied". A tela está em MasterSaudeCompleta.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterSaudeCompletaEstado } from "./MasterSaudeCompleta";
export function MasterSaudeCompletaSemPermissao() {
  return <MasterFrame current="saude"><MasterSaudeCompletaEstado variant="denied" /></MasterFrame>;
}
