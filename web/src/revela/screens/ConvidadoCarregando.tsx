/* Gerado de design-system/revela/html/Convidado-carregando.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import { CameraStage } from "@/components/revela";
import type { CameraStyle } from "@/domain/options";

/** 20g: a câmera do evento com o nome impresso; `name` ausente (convite ainda carregando) omite o "de …". */
export function ConvidadoCarregando({ name = "Ana & Leo", wrap = "casamento" }: { name?: string | null; wrap?: CameraStyle } = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div className="grow" style={{ "display": "flex", "alignItems": "center", "justifyContent": "center" }}>
          <div style={{ "filter": "brightness(.85)", "width": "300px", "transform": "scale(1.6)" }}>
            <CameraStage wrap={wrap} size={640} priority label="" print={{ name: name ?? undefined }} />
          </div>
        </div>
        <p className="rv-stamp">
          CARREGANDO O FILME
        </p>
        <h1 className="rv-title-lg" style={{ "marginTop": "10px" }}>
          Abrindo a câmera
          {name ? <><br />{"de " + name}</> : null}
        </h1>
        <div className="dotsload rv-dots" style={{ "margin": "22px 0 60px" }}>
          <i style={{ "--i": 0 } as React.CSSProperties} />
          <i style={{ "--i": 1 } as React.CSSProperties} />
          <i style={{ "--i": 2 } as React.CSSProperties} />
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
