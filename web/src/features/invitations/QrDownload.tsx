"use client";

import { useState } from "react";
import { Button, Select, Sheet } from "@/components/revela";
import { inviteUrl } from "./links";
import { downloadQr, type QrKind } from "./qr-export";

const KINDS: { kind: QrKind; label: string; help: string }[] = [
  { kind: "svg", label: "SVG (vetorial)", help: "Para gráfica e design: amplia sem perder qualidade." },
  { kind: "png", label: "PNG 2048 px, fundo branco", help: "Com margem de silêncio de 4 módulos." },
  { kind: "png-transparente", label: "PNG 2048 px, fundo transparente", help: "Para pôr sobre a sua arte." },
];

/** "Baixar QR code": só o QR puro (sem logotipo nem texto), no link do evento ou da mesa, para a pessoa montar a arte fora da plataforma. */
export function QrDownloadSheet({ title, code, origin, tables = [], table, onClose }: { title: string; code: string; origin: string; tables?: string[]; table?: string; onClose: () => void }) {
  const [pick, setPick] = useState(table ?? "");
  const [busy, setBusy] = useState<QrKind | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function save(kind: QrKind) {
    setBusy(kind);
    setError(undefined);
    try {
      await downloadQr(inviteUrl(origin, code, pick || undefined), kind, title, pick || undefined);
    } catch {
      setError("Não conseguimos gerar o QR code agora. Tente de novo.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Sheet title="Baixar QR code" onClose={onClose}>
      <p className="app-p app-muted">O QR code abre o link do evento, sem logotipo nem texto, para você usar na sua arte.</p>
      {tables.length > 0 && (
        <Select label="Para qual link" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: "", label: "Geral (todos os convidados)" }, ...tables.map((t) => ({ value: t, label: t }))]} />
      )}
      <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
        {KINDS.map((k, i) => (
          <div key={k.kind}>
            <Button variant={i === 0 ? "primario" : "secundario"} block disabled={busy !== undefined} onClick={() => void save(k.kind)}>{busy === k.kind ? "Gerando…" : k.label}</Button>
            <p className="app-p app-muted" style={{ margin: "4px 0 0" }}>{k.help}</p>
          </div>
        ))}
      </div>
      {error && <p className="app-p" role="alert">{error}</p>}
      <Button variant="texto" block onClick={onClose}>Fechar</Button>
    </Sheet>
  );
}
