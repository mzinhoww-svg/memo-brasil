"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Chips, Field } from "@/components/memoriesmt";
import { COLLAGE_LABEL, COLLAGE_SLOTS, collageSlots, coverCrop, type CollageLayout } from "@/domain/collage";
import type { Photo } from "@/domain/photo";
import { download } from "@/features/admin/export";
import type { Repositories } from "@/repositories";

type Mode = "desenho" | "texto" | "borracha" | "colagem";
type FontId = "serif" | "elegante" | "sans";
interface Stroke { color: string; size: number; erase: boolean; pts: [number, number][] }
interface TextItem { id: string; text: string; x: number; y: number; color: string; font: FontId; size: number }
interface Snap { strokes: Stroke[]; texts: TextItem[]; layout?: CollageLayout; slotIds: string[] }

const COLORS = [{ id: "#FFFFFF", label: "Branco" }, { id: "#1C1917", label: "Tinta" }, { id: "#5B6752", label: "Sálvia" }, { id: "#AAB4A2", label: "Sálvia clara" }];
const FONTS: Record<FontId, { label: string; css: (px: number) => string }> = {
  serif: { label: "Serif", css: (px) => `italic 400 ${px}px "Instrument Serif", serif` },
  elegante: { label: "Elegante", css: (px) => `400 ${px}px var(--fonte-pinyon), "Pinyon Script", cursive` },
  sans: { label: "Sans", css: (px) => `800 ${px}px "Bricolage Grotesque", sans-serif` },
};

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("imagem"));
    i.src = url;
  });
}

/** Editor local (REA F-33): desenho, texto, borracha, colagem, desfazer/refazer. "Concluir" baixa a versão editada. */
export function PhotoEditor({ repos, photo, others, onDone }: { repos: Repositories; photo: Photo; others: Photo[]; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("desenho");
  const [color, setColor] = useState(COLORS[0].id);
  const [font, setFont] = useState<FontId>("sans");
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | undefined>();
  const [history, setHistory] = useState<Snap[]>([{ strokes: [], texts: [], slotIds: [photo.id] }]);
  const [cursor, setCursor] = useState(0);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [error, setError] = useState<string | undefined>();
  const stage = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const dragging = useRef<string | null>(null);
  const snap = history[cursor];

  const commit = useCallback((next: Snap) => {
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor((c) => c + 1);
  }, [cursor]);

  // carrega as imagens necessárias (foto atual + escolhidas para colagem)
  useEffect(() => {
    let alive = true;
    (async () => {
      const need = snap.slotIds.filter((id) => !images[id]);
      if (!need.length) return;
      const loaded: Record<string, HTMLImageElement> = {};
      for (const id of need) {
        const d = await repos.photos.getData(id);
        if (!d) continue;
        loaded[id] = await load(URL.createObjectURL(new Blob([d.bytes], { type: d.type })));
      }
      if (alive && Object.keys(loaded).length) setImages((m) => ({ ...m, ...loaded }));
    })().catch(() => alive && setError("Essa foto não abriu no editor."));
    return () => {
      alive = false;
    };
  }, [snap.slotIds, images, repos]);

  const base = images[photo.id];
  const size = useMemo(() => (base ? { w: base.naturalWidth, h: base.naturalHeight } : { w: 800, h: 1000 }), [base]);

  const paint = useCallback((ctx: CanvasRenderingContext2D, withText: boolean) => {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    if (snap.layout) {
      const slots = collageSlots(snap.layout, w, h, Math.round(w * 0.01));
      slots.forEach((r, i) => {
        const img = images[snap.slotIds[i]];
        if (!img) return;
        const c = coverCrop(img.naturalWidth, img.naturalHeight, r.w, r.h);
        ctx.drawImage(img, c.x, c.y, c.w, c.h, r.x, r.y, r.w, r.h);
      });
    } else if (base) ctx.drawImage(base, 0, 0, w, h);
    // tinta em camada própria: a borracha apaga só os traços
    const ink = document.createElement("canvas");
    ink.width = w;
    ink.height = h;
    const ic = ink.getContext("2d")!;
    for (const s of [...snap.strokes, ...(drawing.current ? [drawing.current] : [])]) {
      ic.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      ic.strokeStyle = s.color;
      ic.lineWidth = s.size;
      ic.lineCap = ic.lineJoin = "round";
      ic.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ic.lineTo(x, y) : ic.moveTo(x, y)));
      if (s.pts.length === 1) ic.lineTo(s.pts[0][0] + 0.01, s.pts[0][1]);
      ic.stroke();
    }
    ctx.drawImage(ink, 0, 0);
    if (withText) {
      for (const t of snap.texts) {
        ctx.font = FONTS[t.font].css(t.size * w);
        ctx.fillStyle = t.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.text, t.x * w, t.y * h);
        if (t.id === selected && withText === true && ctx.canvas === stage.current) {
          const m = ctx.measureText(t.text);
          ctx.strokeStyle = "#1C1917";
          ctx.lineWidth = Math.max(2, w * 0.004);
          ctx.setLineDash([12, 8]);
          ctx.strokeRect(t.x * w - m.width / 2 - 10, t.y * h - t.size * w * 0.6, m.width + 20, t.size * w * 1.2);
          ctx.setLineDash([]);
        }
      }
    }
  }, [size, snap, images, base, selected]);

  useEffect(() => {
    const c = stage.current;
    if (!c) return;
    c.width = size.w;
    c.height = size.h;
    paint(c.getContext("2d")!, true);
  }, [paint, size]);

  const toLocal = (e: React.PointerEvent): [number, number] => {
    const r = stage.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * size.w, ((e.clientY - r.top) / r.height) * size.h];
  };
  const redraw = () => stage.current && paint(stage.current.getContext("2d")!, true);

  function down(e: React.PointerEvent) {
    const [x, y] = toLocal(e);
    if (mode === "texto") {
      const hit = [...snap.texts].reverse().find((t) => Math.abs(t.x * size.w - x) < size.w * 0.25 && Math.abs(t.y * size.h - y) < size.w * t.size);
      setSelected(hit?.id);
      dragging.current = hit?.id ?? null;
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (mode === "colagem") return;
    drawing.current = { color, size: size.w * (mode === "borracha" ? 0.04 : 0.012), erase: mode === "borracha", pts: [[x, y]] };
    (e.target as Element).setPointerCapture(e.pointerId);
    redraw();
  }
  function move(e: React.PointerEvent) {
    const [x, y] = toLocal(e);
    if (drawing.current) {
      drawing.current.pts.push([x, y]);
      redraw();
    } else if (dragging.current) {
      const id = dragging.current;
      const texts = snap.texts.map((t) => (t.id === id ? { ...t, x: x / size.w, y: y / size.h } : t));
      setHistory((h) => h.map((s, i) => (i === cursor ? { ...s, texts } : s)));
    }
  }
  function up() {
    if (drawing.current) {
      const s = drawing.current;
      drawing.current = null;
      commit({ ...snap, strokes: [...snap.strokes, s] });
    }
    dragging.current = null;
  }

  function addText() {
    if (!draft.trim()) return;
    const t: TextItem = { id: crypto.randomUUID(), text: draft.trim(), x: 0.5, y: 0.5, color, font, size: 0.07 };
    commit({ ...snap, texts: [...snap.texts, t] });
    setSelected(t.id);
    setDraft("");
  }
  function removeText() {
    if (!selected) return;
    commit({ ...snap, texts: snap.texts.filter((t) => t.id !== selected) });
    setSelected(undefined);
  }
  function chooseLayout(l: CollageLayout) {
    const ids = [photo.id, ...others.filter((p) => p.id !== photo.id).map((p) => p.id)].slice(0, COLLAGE_SLOTS[l]);
    if (ids.length < COLLAGE_SLOTS[l]) return setError("Ainda não há fotos suficientes neste álbum para essa colagem.");
    setError(undefined);
    commit({ ...snap, layout: l, slotIds: ids });
  }

  async function finish() {
    const out = document.createElement("canvas");
    out.width = size.w;
    out.height = size.h;
    await document.fonts.load(FONTS.sans.css(40));
    await document.fonts.load(FONTS.serif.css(40));
    setSelected(undefined);
    paint(out.getContext("2d")!, true);
    const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
    download(blob, `memoriesmt-editada-${photo.id.slice(0, 8)}.jpg`);
    onDone();
  }

  const tools: { id: Mode; label: string }[] = [{ id: "desenho", label: "Desenho" }, { id: "texto", label: "Texto" }, { id: "borracha", label: "Borracha" }, { id: "colagem", label: "Colagem" }];
  return (
    <div className="app-stack">
      <div className="app-between">
        <Button variant="texto" onClick={onDone}>Cancelar</Button>
        <div className="app-row">
          <Button variant="secundario" small disabled={cursor === 0} onClick={() => setCursor((c) => c - 1)}>Desfazer</Button>
          <Button variant="secundario" small disabled={cursor >= history.length - 1} onClick={() => setCursor((c) => c + 1)}>Refazer</Button>
        </div>
      </div>
      <div className="app-camera" style={{ aspectRatio: `${size.w} / ${size.h}`, touchAction: "none" }}>
        <canvas ref={stage} aria-label="Foto em edição" role="img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ width: "100%", height: "100%", touchAction: "none", cursor: mode === "texto" ? "move" : "crosshair" }} />
      </div>
      {error && <p className="mm-field-erro" role="alert">{error}</p>}
      <Chips label="Ferramentas">
        {tools.map((t) => <Chip key={t.id} variant="filtro" pressed={mode === t.id} onClick={() => setMode(t.id)}>{t.label}</Chip>)}
      </Chips>
      {(mode === "desenho" || mode === "texto") && (
        <Chips label="Cor">
          {COLORS.map((c) => <Chip key={c.id} variant="sugestao" pressed={color === c.id} onClick={() => setColor(c.id)}>{c.label}</Chip>)}
        </Chips>
      )}
      {mode === "texto" && (
        <div className="app-stack-sm">
          <Chips label="Fonte do texto">
            {(Object.keys(FONTS) as FontId[]).map((f) => <Chip key={f} variant="sugestao" pressed={font === f} onClick={() => setFont(f)}>{FONTS[f].label}</Chip>)}
          </Chips>
          <Field label="Texto" value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} />
          <div className="app-row">
            <Button variant="secundario" small disabled={!draft.trim()} onClick={addText}>Adicionar texto</Button>
            <Button variant="destrutivo" small disabled={!selected} onClick={removeText}>Excluir texto</Button>
          </div>
          <p className="mm-field-ajuda">Toque no texto na foto e arraste para mudar de lugar.</p>
        </div>
      )}
      {mode === "colagem" && (
        <div className="app-stack-sm">
          <span className="mm-group-label">Criar colagem</span>
          <Chips label="Layout da colagem">
            {(Object.keys(COLLAGE_LABEL) as CollageLayout[]).map((l) => <Chip key={l} variant="filtro" pressed={snap.layout === l} onClick={() => chooseLayout(l)}>{COLLAGE_LABEL[l]}</Chip>)}
          </Chips>
          {others.length === 0 && <p className="mm-field-ajuda">Ainda não há outras fotos neste álbum.</p>}
        </div>
      )}
      <Button variant="cta" icon="baixar" block disabled={!base} onClick={finish}>Concluir e baixar</Button>
    </div>
  );
}
