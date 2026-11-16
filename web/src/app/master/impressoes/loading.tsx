import { MasterStatePage } from "@/revela/master/MasterState";
import { ExportButtonStatic } from "@/revela/screens/MasterImpressoes";

/** M29.c: carregando. */
export default function Loading() {
  return <MasterStatePage area="Impressões" variant="loading" cols={8} rows={8} actions={<ExportButtonStatic />} />;
}
