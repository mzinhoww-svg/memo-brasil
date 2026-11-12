// @vitest-environment jsdom
/* Fidelidade das telas M29, M30 e M31 (e variantes e folhas) ao HTML de referência: o DOM de .mmain (sem a barra de cima) tem de ter as mesmas tags,
   classes e textos que design-system/revela/master/html/*.html. Mais o comportamento das folhas (motivo de 10 a 500, valor inválido, erro do servidor). */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MasterConfigRevisada } from "../screens/MasterConfigRevisada";
import { MasterConfigRevisadaCarregando } from "../screens/MasterConfigRevisadaCarregando";
import { MasterConfigRevisadaErro } from "../screens/MasterConfigRevisadaErro";
import { MasterConfigRevisadaFolhaAlterar } from "../screens/MasterConfigRevisadaFolhaAlterar";
import { MasterConfigRevisadaFolhaChave } from "../screens/MasterConfigRevisadaFolhaChave";
import { MasterConfigRevisadaSemPermissao } from "../screens/MasterConfigRevisadaSemPermissao";
import { MasterConfigRevisadaVazio } from "../screens/MasterConfigRevisadaVazio";
import { MasterImpressaoDetalhe } from "../screens/MasterImpressaoDetalhe";
import { MasterImpressaoDetalheCarregando } from "../screens/MasterImpressaoDetalheCarregando";
import { MasterImpressaoDetalheErro } from "../screens/MasterImpressaoDetalheErro";
import { MasterImpressaoDetalheFolhaAvancar } from "../screens/MasterImpressaoDetalheFolhaAvancar";
import { MasterImpressaoDetalheFolhaCancelar } from "../screens/MasterImpressaoDetalheFolhaCancelar";
import { MasterImpressaoDetalheSemPermissao } from "../screens/MasterImpressaoDetalheSemPermissao";
import { MasterImpressaoDetalheVazio } from "../screens/MasterImpressaoDetalheVazio";
import { MasterImpressoes } from "../screens/MasterImpressoes";
import { MasterImpressoesCarregando } from "../screens/MasterImpressoesCarregando";
import { MasterImpressoesErro } from "../screens/MasterImpressoesErro";
import { MasterImpressoesSemPermissao } from "../screens/MasterImpressoesSemPermissao";
import { MasterImpressoesVazio } from "../screens/MasterImpressoesVazio";
import { FlagSheet, SettingSheet } from "./ConfigSheets";
import { PrintAdvanceSheet, PrintCancelSheet } from "./PrintOrderSheets";

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
/** Tudo em .mmain depois da barra de cima (cabeçalho, corpo, folha). */
const mainSig = (root: ParentNode) => [...root.querySelector(".mmain")!.children].filter((c) => !c.classList.contains("mtop")).flatMap((c) => sig(c));

const SCREENS: [string, string, ComponentType][] = [
  ["M29", "Master-impressoes", MasterImpressoes], ["M29.v", "Master-impressoes--vazio", MasterImpressoesVazio], ["M29.e", "Master-impressoes--erro", MasterImpressoesErro],
  ["M29.p", "Master-impressoes--sem-permissao", MasterImpressoesSemPermissao], ["M29.c", "Master-impressoes--carregando", MasterImpressoesCarregando],
  ["M30", "Master-impressao-detalhe", MasterImpressaoDetalhe], ["M30.v", "Master-impressao-detalhe--vazio", MasterImpressaoDetalheVazio], ["M30.e", "Master-impressao-detalhe--erro", MasterImpressaoDetalheErro],
  ["M30.p", "Master-impressao-detalhe--sem-permissao", MasterImpressaoDetalheSemPermissao], ["M30.c", "Master-impressao-detalhe--carregando", MasterImpressaoDetalheCarregando],
  ["M30.f1", "Master-impressao-detalhe--folha-avancar", MasterImpressaoDetalheFolhaAvancar], ["M30.f2", "Master-impressao-detalhe--folha-cancelar", MasterImpressaoDetalheFolhaCancelar],
  ["M31", "Master-config-revisada", MasterConfigRevisada], ["M31.v", "Master-config-revisada--vazio", MasterConfigRevisadaVazio], ["M31.e", "Master-config-revisada--erro", MasterConfigRevisadaErro],
  ["M31.p", "Master-config-revisada--sem-permissao", MasterConfigRevisadaSemPermissao], ["M31.c", "Master-config-revisada--carregando", MasterConfigRevisadaCarregando],
  ["M31.f1", "Master-config-revisada--folha-alterar", MasterConfigRevisadaFolhaAlterar], ["M31.f2", "Master-config-revisada--folha-chave", MasterConfigRevisadaFolhaChave],
];

describe("telas M29, M30 e M31 = HTML de referência", () => {
  it.each(SCREENS)("%s · %s", (_id, name, Screen) => {
    const { container } = render(<Screen />);
    expect(mainSig(container)).toEqual(mainSig(ref(name)));
  });
});

const noop = () => undefined;
describe("folhas do pedido de impressão", () => {
  it("avançar não pede motivo e confirma uma vez", async () => {
    const onConfirm = vi.fn();
    render(<PrintAdvanceSheet code="IMP-7K2Q" from="solicitado" to="em_producao" onConfirm={onConfirm} onCancel={noop} inline />);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Marcar em produção" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
  it("avançar mostra o erro do servidor", () => {
    render(<PrintAdvanceSheet code="IMP-7K2Q" from="solicitado" to="em_producao" onConfirm={noop} onCancel={noop} error="O pedido já mudou de estado. Atualize a página." inline />);
    expect(screen.getByRole("alert").textContent).toContain("O pedido já mudou de estado");
  });
  it("cancelar só liga com motivo de 10 a 500 caracteres e entrega o motivo aparado", async () => {
    const onConfirm = vi.fn();
    render(<PrintCancelSheet code="IMP-7K2Q" onConfirm={onConfirm} onCancel={noop} inline />);
    const btn = screen.getByRole("button", { name: "Cancelar pedido" }) as HTMLButtonElement;
    const box = screen.getByLabelText("Motivo");
    expect(btn.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "123456789" } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "x".repeat(501) } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "  Pediu o cancelamento por telefone  " } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Pediu o cancelamento por telefone"));
    expect(screen.getByText("Não dá para reabrir um pedido cancelado.")).toBeTruthy();
  });
});

describe("folhas das Configurações", () => {
  const sheet = (value: string, onConfirm = vi.fn()) => {
    render(<SettingSheet title="Alterar a validade do Pix" body="b" today="15 min" fieldLabel="Novo valor (5 a 1.440)" value={value} onValue={noop} unit="min" inputLabel="Minutos"
      invalid={/^\d+$/.test(value) && +value >= 5 && +value <= 1440 ? null : "Validade do Pix: de 5 a 1.440 minutos."} onConfirm={onConfirm} onCancel={noop} initialReason="Motivo com mais de dez" inline />);
    return onConfirm;
  };
  it("valor fora de 5 a 1.440 não chega ao servidor, mesmo com motivo válido", async () => {
    for (const bad of ["4", "1441", "", "abc"]) {
      const onConfirm = sheet(bad);
      expect(screen.getByRole("alert").textContent).toContain("5 a 1.440");
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await Promise.resolve();
      expect(onConfirm).not.toHaveBeenCalled();
      cleanup();
    }
  });
  it("valor válido com motivo válido confirma com o motivo", async () => {
    const onConfirm = sheet("30");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Motivo com mais de dez"));
  });
  it("sem motivo de 10 caracteres o botão fica desligado", () => {
    render(<SettingSheet title="t" body="b" today="15 min" fieldLabel="f" value="30" onValue={noop} inputLabel="Minutos" onConfirm={noop} onCancel={noop} inline initialReason="curto" />);
    expect((screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("chave: desligar é vermelho e pede motivo", () => {
    render(<FlagSheet title="Desligar o checkout?" body="b" confirmLabel="Desligar checkout" tone="danger" onConfirm={noop} onCancel={noop} inline />);
    const b = screen.getByRole("button", { name: "Desligar checkout" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.className).toContain("rv-btn--line");
  });
});
