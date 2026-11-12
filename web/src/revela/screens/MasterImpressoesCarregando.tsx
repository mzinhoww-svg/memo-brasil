/* Master-impressoes--carregando.html (M29.c): 8 linhas × 8 colunas de esqueleto. */
import { MasterStatePage } from "../master/MasterState";
import { MasterFrame } from "../master-kit";
import { ExportButtonStatic } from "./MasterImpressoes";

export function MasterImpressoesCarregando() {
  return <MasterFrame current="impressoes"><MasterStatePage area="Impressões" variant="loading" cols={8} rows={8} actions={<ExportButtonStatic />} /></MasterFrame>;
}
