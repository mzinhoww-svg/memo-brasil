import { bytes, num, requireMaster, rpc } from "../data";
import { Metric, PageHead, StateBox } from "../ui";

interface M { storage: { photosBytes: number; photosObjects: number; brandingBytes: number; brandingObjects: number }; uploads: { failed: number; inProgress: number }; photos: { total: number } }
export default async function Storage() {
  const sb = await requireMaster();
  const r = await rpc<M>(sb, "admin_dashboard_metrics");
  return (
    <>
      <PageHead titulo="Storage e fotos" texto="Consumo e saúde do armazenamento. O console não lista nem exibe fotografias privadas; o acesso excepcional exige justificativa e fica na auditoria." />
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <div className="adm-grid">
          <Metric rotulo="Fotos (bucket privado)" valor={bytes(r.data.storage.photosBytes)} nota={`${num(r.data.storage.photosObjects)} arquivos · ${num(r.data.photos.total)} fotos prontas`} />
          <Metric rotulo="Identidade visual" valor={bytes(r.data.storage.brandingBytes)} nota={`${num(r.data.storage.brandingObjects)} arquivos`} />
          <Metric rotulo="Uploads com falha" valor={num(r.data.uploads.failed)} />
          <Metric rotulo="Uploads em andamento" valor={num(r.data.uploads.inProgress)} />
        </div>
      )}
    </>
  );
}
