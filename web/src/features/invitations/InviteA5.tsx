"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/revela";
import type { MemoEvent } from "@/domain/event";
import { PT, TRIM, type FontId, type InviteLayout } from "./invite-layout";
import { buildInvitePdf, FONT_FILES, inviteLayout, loadInviteFonts, printable, type InviteFonts } from "./invite-pdf";
import { printInvite } from "./invite-print";

/** As mesmas fontes estáticas do PDF, para a prévia ter as mesmas quebras de linha. */
const FAMILY: Record<FontId, string> = { bold: "MM Convite Bold", regular: "MM Convite Regular", italic: "MM Convite Italic" };
const FACES = (Object.keys(FONT_FILES) as FontId[]).map((id) => `@font-face{font-family:"${FAMILY[id]}";src:url("${FONT_FILES[id]}") format("woff");font-display:block}`).join("");

let fontsOnce: Promise<InviteFonts> | null = null;
const fontsFromSite = () =>
  (fontsOnce ??= loadInviteFonts(async (p) => {
    const r = await fetch(p);
    if (!r.ok) throw new Error(`fonte ${p}: HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }).catch((e) => { fontsOnce = null; throw e; }));

/** Desenho do convite (corte 148 × 210 mm) em SVG, a partir da diagramação comum ao PDF. */
export function InviteSvg({ layout, fonts, label }: { layout: InviteLayout; fonts: InviteFonts; label: string }) {
  return (
    <svg className="convite-a5" viewBox={`0 0 ${TRIM.w} ${TRIM.h}`} role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      <rect x={0} y={0} width={TRIM.w} height={TRIM.h} fill="#FFFFFF" />
      {layout.prims.map((p, i) => {
        if (p.kind === "rect") return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.color} />;
        if (p.kind === "line") return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.widthMm} />;
        if (p.kind === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.color} />;
        if (p.kind === "text")
          return (
            <text key={i} x={p.x} y={p.y} fontFamily={FAMILY[p.font]} fontSize={p.size * PT} fill={p.color} textAnchor={p.anchor} letterSpacing={p.tracking}>
              {printable(p.text, fonts.kit[p.font])}
            </text>
          );
        const n = p.modules.length, cell = p.size / (n + 2 * p.quiet);
        const d = p.modules.flatMap((row, r) => row.map((on, c) => (on ? `M${p.x + (p.quiet + c) * cell} ${p.y + (p.quiet + r) * cell}h${cell}v${cell}h-${cell}z` : ""))).join("");
        return (
          <g key={i} data-testid="convite-qr">
            <rect x={p.x} y={p.y} width={p.size} height={p.size} fill="#FFFFFF" />
            <path d={d} fill={p.color} shapeRendering="crispEdges" />
          </g>
        );
      })}
    </svg>
  );
}

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Convite A5 do evento: prévia fiel, "Baixar PDF para gráfica" e "Imprimir" (só o convite, em A5). */
export function InviteA5({ event, now }: { event: MemoEvent; now: number }) {
  const inv = useMemo(() => printInvite(event, now), [event, now]);
  const [fonts, setFonts] = useState<InviteFonts | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    fontsFromSite().then((f) => { if (alive) setFonts(f); }, () => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);
  const layout = useMemo(() => (fonts ? inviteLayout(inv, fonts) : undefined), [inv, fonts]);

  async function onDownload() {
    setBusy(true);
    setPdfError(undefined);
    try {
      download(await buildInvitePdf(inv, fonts ?? (await fontsFromSite())), inv.fileName);
    } catch {
      setPdfError("Não conseguimos gerar o PDF. Confira a conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function onPrint() {
    document.body.dataset.imprimir = "convite";
    const done = () => { delete document.body.dataset.imprimir; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <section className="app-stack-sm convite-a5-bloco" aria-labelledby="convite-titulo">
      <style>{FACES}</style>
      <div className="no-print app-stack-sm">
        <h2 id="convite-titulo" className="titulo-card app-h1">Convite A5</h2>
        <p className="app-p app-muted">148 × 210 mm, fundo claro. O PDF já sai com 3 mm de sangria para a gráfica.</p>
        <div className="app-row" style={{ flexWrap: "wrap" }}>
          <Button variant="pequeno" icon="baixar" onClick={() => void onDownload()} disabled={busy || loadError}>{busy ? "Gerando PDF…" : "Baixar PDF para gráfica"}</Button>
          <Button variant="secundario" small onClick={onPrint} disabled={!layout}>Imprimir</Button>
        </div>
        {pdfError && <p className="app-banner" role="alert">{pdfError}</p>}
        {loadError && (
          <p className="app-banner" role="alert">
            Não conseguimos carregar as fontes do convite.{" "}
            <button type="button" className="rv-link" onClick={() => { setLoadError(false); fontsFromSite().then(setFonts, () => setLoadError(true)); }}>Tentar de novo</button>
          </p>
        )}
      </div>
      <div className="convite-a5-folha">
        {layout && fonts ? <InviteSvg layout={layout} fonts={fonts} label={`Convite de ${inv.title}: QR Code para ${inv.qrText}, código ${inv.code}`} /> : !loadError && <p className="app-muted" role="status">Montando o convite…</p>}
      </div>
    </section>
  );
}
