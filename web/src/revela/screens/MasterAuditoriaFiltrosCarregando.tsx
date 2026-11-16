/* Master-auditoria-filtros--*.html (M28): estado "loading". A tela está em MasterAuditoriaFiltros.tsx. */
import { MasterFrame } from "../master-kit";
import { MasterAuditoriaFiltrosEstado } from "./MasterAuditoriaFiltros";
export function MasterAuditoriaFiltrosCarregando() {
  return <MasterFrame current="auditoria"><MasterAuditoriaFiltrosEstado variant="loading" /></MasterFrame>;
}
