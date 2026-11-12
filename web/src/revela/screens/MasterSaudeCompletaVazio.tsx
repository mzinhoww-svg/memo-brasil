/* Master-saude-completa--*.html (M27): estado "empty". A tela está em MasterSaudeCompleta.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterSaudeCompletaEstado } from "./MasterSaudeCompleta";
export function MasterSaudeCompletaVazio() {
  return <MasterFrame current="saude"><MasterSaudeCompletaEstado variant="empty" /></MasterFrame>;
}
