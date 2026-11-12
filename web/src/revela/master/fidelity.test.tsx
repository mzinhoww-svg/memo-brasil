// @vitest-environment jsdom
/* Fidelidade das folhas e dos estados: o DOM de cada componente tem de ter as mesmas tags, classes e textos que o HTML de referência
   (design-system/revela/master/html/*.html). Compara a "assinatura" (tag.classes + texto) e ignora o que não se vê: style, aria-*, valor dos campos,
   o miolo dos <svg> e o campo invisível do código do autenticador. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionSheet } from "./ActionSheet";
import { ExportSheet } from "./ExportSheet";
import { MasterState } from "./MasterState";
import { ReconcileSheet } from "./ReconcileSheet";
import { RevealNowSheet } from "./RevealNowSheet";

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
const refText = (name: string, sel: string) => ref(name).querySelector(sel)!.textContent!.trim();
const noop = () => undefined;

describe("estados = HTML de referência", () => {
  it.each([
    ["vazio", <MasterState key="v" variant="empty" title="Nenhuma conta neste filtro" text="Troque o filtro ou limpe a busca." />, "Master-pessoas-contas--vazio", ".mstate"],
    ["erro", <MasterState key="e" variant="error" onRetry={noop} />, "Master-pessoas-contas--erro", ".mstate"],
    ["sem permissão", <MasterState key="p" variant="denied" />, "Master-pessoas-contas--sem-permissao", ".mstate"],
    ["carregando", <MasterState key="c" variant="loading" cols={6} />, "Master-pessoas-contas--carregando", ".mtable"],
  ])("%s", (_n, el, name, sel) => {
    const { container } = render(el);
    expect(sig(container.firstElementChild!)).toEqual(sig(ref(name).querySelector(sel)!));
  });
  it("carregando: as larguras das barras são as do desenho", () => {
    const { container } = render(<MasterState variant="loading" cols={6} />);
    const w = (root: Element) => [...root.querySelectorAll(".msk")].map((i) => (i as HTMLElement).style.width);
    expect(w(container)).toEqual(w(ref("Master-pessoas-contas--carregando").body));
  });
});

describe("folhas = HTML de referência", () => {
  it("M24 Exportar", () => {
    const { container } = render(<ExportSheet kind="pagamentos" filters={{}} screen="pagamentos" screenLabel="Pagamentos" period="01 nov 2026 a 11 nov 2026" filtersText="Método: Pix · Situação: todas" rowsEstimate={74} format="CSV (UTF-8, separador ;)" onClose={noop} inline />);
    expect(mine(container)).toEqual(refSheet("Master-exportar--folha"));
  });
  it("M24-t Exportar truncado", () => {
    const { container } = render(<ExportSheet kind="pagamentos" filters={{}} screen="pagamentos" screenLabel="Pagamentos" period="01 nov 2026 a 11 nov 2026" filtersText="Método: Pix · Situação: todas" rowsEstimate={63900} format="CSV (UTF-8, separador ;)" onClose={noop} inline />);
    expect(mine(container)).toEqual(refSheet("Master-exportar--folha-truncado"));
  });

  const reasonOf = (name: string) => ref(name).querySelector(".mmodal textarea")!.textContent!;
  const revealProps = { eventId: "e1", eventTitle: "Ana & Leo", plannedAt: "dom, 15 mar 2027 12:00", notices: "21 e-mails, de uma vez", onClose: noop, inline: true };
  it("M25 Revelar agora", () => {
    const { container } = render(<RevealNowSheet {...revealProps} initialReason={reasonOf("Master-revelar-agora--folha")} />);
    expect(mine(container)).toEqual(refSheet("Master-revelar-agora--folha"));
  });
  it.each([
    ["Master-revelar-agora--folha-erro-ja-revelado", "revealed"],
    ["Master-revelar-agora--folha-erro-sem-revelacao", "invalid"],
    ["Master-revelar-agora--folha-erro-sem-permissao", "forbidden"],
  ] as const)("M25 erro: %s", async (name, failure) => {
    const { container } = render(<RevealNowSheet {...revealProps} initialReason={reasonOf(name)} send={vi.fn(async () => ({ ok: false as const, failure }))} />);
    fireEvent.click(screen.getByRole("button", { name: "Revelar mesmo assim" }));
    await screen.findByRole("alert");
    expect(mine(container)).toEqual(refSheet(name));
  });

  it("M23 Conciliar: código", () => {
    const { container } = render(<ReconcileSheet state={{ step: "code" }} initialCode="305" onSubmitCode={noop} onClose={noop} inline />);
    expect(mine(container)).toEqual(refSheet("Master-pagamentos--folha-conciliar-codigo"));
  });
  it("M23-w Conciliar: espera", () => {
    const { container } = render(<ReconcileSheet state={{ step: "wait", remaining: 42, last: "hoje 08:51, por marcos@revela.app" }} onSubmitCode={noop} onClose={noop} inline />);
    expect(mine(container)).toEqual(refSheet("Master-pagamentos--folha-conciliar-espera"));
  });
  it("M23-r Conciliar: resultado", () => {
    const state = { step: "result" as const, nextIn: 57, result: { confirmed: 12, failed: 1, unchanged: 58, at: "hoje 08:51", tookSeconds: 4, failures: [{ label: "#RV-2039 · Formatura Medicina", message: "A ValidaPay não respondeu a tempo. Tente de novo em 1 min." }] } };
    const { container } = render(<ReconcileSheet state={state} onSubmitCode={noop} onClose={noop} inline />);
    expect(mine(container)).toEqual(refSheet("Master-pagamentos--folha-conciliar-resultado"));
  });

  it("folha de ação: Revogar papel (equipe)", () => {
    const name = "Master-pessoas-equipe--folha-revogar";
    const { container } = render(<ActionSheet title="Revogar o papel de support?" body="suporte@revela.app perde o acesso ao console na hora." confirmLabel="Revogar papel" tone="danger" initialReason={reasonOf(name)} onConfirm={noop} onCancel={noop} inline />);
    expect(mine(container)).toEqual(refSheet(name));
  });
  it("folha de ação: Desligar checkout (config)", () => {
    const name = "Master-config-revisada--folha-chave";
    const { container } = render(<ActionSheet title="Desligar o checkout?" body="Ninguém consegue pagar planos enquanto estiver desligado. Eventos já pagos não mudam." confirmLabel="Desligar checkout" tone="danger" initialReason={reasonOf(name)} onConfirm={noop} onCancel={noop} inline />);
    expect(mine(container)).toEqual(refSheet(name));
  });
  it("folha de ação: Esconder foto (moderação), botão principal cheio", () => {
    const name = "Master-moderacao-motivos--folha-esconder";
    const { container } = render(<ActionSheet title="Esconder esta foto?" body="foto 3f1a… · Chá da Maria · 3 denúncias. Ela sai do feed para todos os convidados." confirmLabel="Esconder foto" initialReason={reasonOf(name)} onConfirm={noop} onCancel={noop} inline />);
    expect(mine(container)).toEqual(refSheet(name));
  });
  it("folha de ação: valor antigo e novo (.diff)", () => {
    const name = "Master-config-revisada--folha-alterar";
    const html = ref(name);
    expect(html.querySelector(".mmodal .diff")).not.toBeNull();
    const { container } = render(<ActionSheet title="Alterar a validade do Pix" body="Vale para os próximos Pix gerados. Os que já estão abertos mantêm a validade antiga." confirmLabel="Salvar" initialReason={reasonOf(name)}
      diff={{ from: { label: "Hoje", value: "15 min" }, to: { label: "Novo valor (5 a 1.440)", value: <label className="mfield mfield--on" style={{ maxWidth: "120px" }}><input defaultValue="30" aria-label="Minutos" /><i>min</i></label> } }} onConfirm={noop} onCancel={noop} inline />);
    expect(mine(container)).toEqual(refSheet(name));
  });
});

it("a referência é lida (guarda contra caminho errado)", () => {
  expect(refText("Master-exportar--folha", ".mmodal h2")).toBe("Exportar");
});
