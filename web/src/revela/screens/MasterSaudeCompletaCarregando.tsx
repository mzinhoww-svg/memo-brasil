/* Master-saude-completa--*.html (M27): estado "loading". A tela está em MasterSaudeCompleta.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterSaudeCompletaEstado } from "./MasterSaudeCompleta";
export function MasterSaudeCompletaCarregando() {
  return <MasterFrame current="saude"><MasterSaudeCompletaEstado variant="loading" /></MasterFrame>;
}
