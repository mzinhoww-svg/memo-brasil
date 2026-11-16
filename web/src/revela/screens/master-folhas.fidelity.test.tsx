// @vitest-environment jsdom
/* Fidelidade das folhas do grupo Visão geral · Eventos · Pagamentos: tags, classes e textos iguais aos HTML de referência
   (a mesma "assinatura" de revela/master/fidelity.test.tsx). */
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ActionSheet } from "../master/ActionSheet";
import { RefusalSheet } from "./MasterEventosFolhas";

afterEach(cleanup);
const HTML = resolve(process.cwd(), "../design-system/revela/master/html");
const ref = (name: string) => new DOMParser().parseFromString(readFileSync(resolve(HTML, `${name}.html`), "utf8"), "text/html");
function sig(el: Element, out: string[] = [], depth = 0): string[] {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "style" || tag === "script") return out;
  const cls = [...el.classList].sort().join(".");
  out.push(`${"  ".repeat(depth)}${tag}${cls ? "." + cls : ""}`);
  if (tag === "svg" || tag === "textarea") return out;
  let text = "";
  const flush = () => { const t = text.replace(/\s+/g, " ").trim(); if (t) out.push(`${"  ".repeat(depth + 1)}"${t}"`); text = ""; };
  for (const n of el.childNodes) {
    if (n.nodeType === 3) text += n.textContent ?? "";
    else if (n.nodeType === 1) { flush(); sig(n as Element, out, depth + 1); }
  }
  flush();
  return out;
}
const refSheet = (name: string) => sig(ref(name).querySelector(".mmodal")!);
const mine = (c: HTMLElement) => sig(c.querySelector(".mmodal")!);
const reasonOf = (name: string) => ref(name).querySelector(".mmodal textarea")!.textContent!;
const noop = () => undefined;

describe("folhas de eventos de teste = HTML de referência", () => {
  it("M21-f1 Marcar como teste", () => {
    const name = "Master-evento-detalhe--folha-teste";
    const { container } = render(<ActionSheet inline title="Marcar como evento de teste?" body="Eventos de teste saem das métricas e podem ser excluídos em lote. Evento pago não pode ser marcado." confirmLabel="Marcar como teste" initialReason={reasonOf(name)} onConfirm={noop} onCancel={noop} />);
    expect(mine(container)).toEqual(refSheet(name));
  });
  it("M21-f1r recusa", () => {
    const { container } = render(<RefusalSheet inline title="Não dá para marcar como teste" body="Só eventos sem pagamento podem virar teste." error="Este evento tem pagamento confirmado (Pix #RV-2041)." closeLabel="Entendi" onClose={noop} />);
    expect(mine(container)).toEqual(refSheet("Master-evento-detalhe--folha-teste-recusa"));
  });
  it("M21-f2 Excluir evento de teste", () => {
    const name = "Master-evento-detalhe--folha-excluir-teste";
    const { container } = render(<ActionSheet inline title="Excluir este evento de teste?" body="O evento, as 12 fotos e os convites somem. Só eventos marcados como teste e sem pagamento podem ser excluídos." confirmLabel="Excluir evento" tone="danger" initialReason={reasonOf(name)} onConfirm={noop} onCancel={noop} />);
    expect(mine(container)).toEqual(refSheet(name));
  });
  it("M22-f1 Excluir em lote", () => {
    const name = "Master-eventos-teste--folha-excluir-lote";
    const { container } = render(
      <ActionSheet inline title="Excluir 3 eventos de teste?" body="Os eventos, as 52 fotos e os convites somem." confirmLabel="Excluir 3 eventos" tone="danger" initialReason={reasonOf(name)} onConfirm={noop} onCancel={noop}>
        <div className="rv-group" style={{ marginTop: "16px" }}>{["Teste QA · câmera noite", "Teste checkout Pix", "Demo comercial buffet"].map((t) => <div className="rv-row" key={t}><div className="rv-row__text">{t}</div></div>)}</div>
      </ActionSheet>,
    );
    expect(mine(container)).toEqual(refSheet(name));
  });
  it("M22-f2 Lote recusado", () => {
    const { container } = render(<RefusalSheet inline title="Lote recusado" body="Nada foi excluído. Tire estes eventos da seleção e tente de novo." closeLabel="Voltar para a lista" onClose={noop}
      items={[{ key: "1", title: "Ana & Leo", reason: "Não é evento de teste" }, { key: "2", title: "Teste checkout Pix", reason: "Tem pagamento confirmado em produção" }]} />);
    expect(mine(container)).toEqual(refSheet("Master-eventos-teste--folha-recusa"));
  });
});
