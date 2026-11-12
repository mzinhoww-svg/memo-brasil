/* Master-auditoria-filtros--*.html (M28): estado "denied". A tela está em MasterAuditoriaFiltros.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterAuditoriaFiltrosEstado } from "./MasterAuditoriaFiltros";
export function MasterAuditoriaFiltrosSemPermissao() {
  return <MasterFrame current="auditoria"><MasterAuditoriaFiltrosEstado variant="denied" /></MasterFrame>;
}
