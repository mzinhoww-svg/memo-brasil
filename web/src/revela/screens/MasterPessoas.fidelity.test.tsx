// @vitest-environment jsdom
/* Fidelidade das 27 telas de Pessoas (M15 a M19): o DOM de cada componente, com os dados do desenho, tem de ter as mesmas tags, classes e textos
   que o HTML de referência (design-system/revela/master/html/Master-pessoas-*.html). Ignora style, aria-*, valor dos campos e o miolo dos <svg>. */
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MasterPessoasContas } from "./MasterPessoasContas";
import { MasterPessoasContasCarregando } from "./MasterPessoasContasCarregando";
import { MasterPessoasContasErro } from "./MasterPessoasContasErro";
import { MasterPessoasContasSemPermissao } from "./MasterPessoasContasSemPermissao";
import { MasterPessoasContasVazio } from "./MasterPessoasContasVazio";
import { MasterPessoasConvidados } from "./MasterPessoasConvidados";
import { MasterPessoasConvidadosCarregando } from "./MasterPessoasConvidadosCarregando";
import { MasterPessoasConvidadosErro } from "./MasterPessoasConvidadosErro";
import { MasterPessoasConvidadosSemPermissao } from "./MasterPessoasConvidadosSemPermissao";
import { MasterPessoasConvidadosVazio } from "./MasterPessoasConvidadosVazio";
import { MasterPessoasConvites } from "./MasterPessoasConvites";
import { MasterPessoasConvitesCarregando } from "./MasterPessoasConvitesCarregando";
import { MasterPessoasConvitesErro } from "./MasterPessoasConvitesErro";
import { MasterPessoasConvitesSemPermissao } from "./MasterPessoasConvitesSemPermissao";
import { MasterPessoasConvitesVazio } from "./MasterPessoasConvitesVazio";
import { MasterPessoasEquipe } from "./MasterPessoasEquipe";
import { MasterPessoasEquipeCarregando } from "./MasterPessoasEquipeCarregando";
import { MasterPessoasEquipeErro } from "./MasterPessoasEquipeErro";
import { MasterPessoasEquipeFolhaConceder } from "./MasterPessoasEquipeFolhaConceder";
import { MasterPessoasEquipeFolhaRevogar } from "./MasterPessoasEquipeFolhaRevogar";
import { MasterPessoasEquipeSemPermissao } from "./MasterPessoasEquipeSemPermissao";
import { MasterPessoasEquipeVazio } from "./MasterPessoasEquipeVazio";
import { MasterPessoasOrganizadores } from "./MasterPessoasOrganizadores";
import { MasterPessoasOrganizadoresCarregando } from "./MasterPessoasOrganizadoresCarregando";
import { MasterPessoasOrganizadoresErro } from "./MasterPessoasOrganizadoresErro";
import { MasterPessoasOrganizadoresSemPermissao } from "./MasterPessoasOrganizadoresSemPermissao";
import { MasterPessoasOrganizadoresVazio } from "./MasterPessoasOrganizadoresVazio";

afterEach(cleanup);
const HTML = resolve(process.cwd(), "../design-system/revela/master/html");
const ref = (name: string) => new DOMParser().parseFromString(readFileSync(resolve(HTML, `${name}.html`), "utf8"), "text/html");

function sig(el: Element, out: string[] = [], depth = 0): string[] {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "style" || tag === "script" || el.hasAttribute("data-rsp")) return out; // data-rsp: peças só do app responsivo (botão de menu, fundo da gaveta)
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

const SCREENS: [string, () => React.ReactElement, string][] = [
  ["M15", MasterPessoasContas, "Master-pessoas-contas"], ["M15.v", MasterPessoasContasVazio, "Master-pessoas-contas--vazio"], ["M15.e", MasterPessoasContasErro, "Master-pessoas-contas--erro"],
  ["M15.p", MasterPessoasContasSemPermissao, "Master-pessoas-contas--sem-permissao"], ["M15.c", MasterPessoasContasCarregando, "Master-pessoas-contas--carregando"],
  ["M16", MasterPessoasOrganizadores, "Master-pessoas-organizadores"], ["M16.v", MasterPessoasOrganizadoresVazio, "Master-pessoas-organizadores--vazio"],
  ["M16.e", MasterPessoasOrganizadoresErro, "Master-pessoas-organizadores--erro"], ["M16.p", MasterPessoasOrganizadoresSemPermissao, "Master-pessoas-organizadores--sem-permissao"],
  ["M16.c", MasterPessoasOrganizadoresCarregando, "Master-pessoas-organizadores--carregando"],
  ["M17", MasterPessoasConvidados, "Master-pessoas-convidados"], ["M17.v", MasterPessoasConvidadosVazio, "Master-pessoas-convidados--vazio"],
  ["M17.e", MasterPessoasConvidadosErro, "Master-pessoas-convidados--erro"], ["M17.p", MasterPessoasConvidadosSemPermissao, "Master-pessoas-convidados--sem-permissao"],
  ["M17.c", MasterPessoasConvidadosCarregando, "Master-pessoas-convidados--carregando"],
  ["M18", MasterPessoasConvites, "Master-pessoas-convites"], ["M18.v", MasterPessoasConvitesVazio, "Master-pessoas-convites--vazio"], ["M18.e", MasterPessoasConvitesErro, "Master-pessoas-convites--erro"],
  ["M18.p", MasterPessoasConvitesSemPermissao, "Master-pessoas-convites--sem-permissao"], ["M18.c", MasterPessoasConvitesCarregando, "Master-pessoas-convites--carregando"],
  ["M19", MasterPessoasEquipe, "Master-pessoas-equipe"], ["M19.v", MasterPessoasEquipeVazio, "Master-pessoas-equipe--vazio"], ["M19.e", MasterPessoasEquipeErro, "Master-pessoas-equipe--erro"],
  ["M19.p", MasterPessoasEquipeSemPermissao, "Master-pessoas-equipe--sem-permissao"], ["M19.c", MasterPessoasEquipeCarregando, "Master-pessoas-equipe--carregando"],
  ["M19.f1", MasterPessoasEquipeFolhaConceder, "Master-pessoas-equipe--folha-conceder"], ["M19.f2", MasterPessoasEquipeFolhaRevogar, "Master-pessoas-equipe--folha-revogar"],
];

describe("Pessoas (M15 a M19) = HTML de referência", () => {
  it.each(SCREENS)("%s", (_id, C, html) => {
    const { container } = render(<C />);
    expect(sig(container.querySelector(".dsk")!)).toEqual(sig(ref(html).querySelector(".dsk")!));
  });
});
