/* Master-saude-completa--*.html (M27): estado "error". A tela está em MasterSaudeCompleta.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterSaudeCompletaEstado } from "./MasterSaudeCompleta";
export function MasterSaudeCompletaErro() {
  return <MasterFrame current="saude"><MasterSaudeCompletaEstado variant="error" /></MasterFrame>;
}
