import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIRST_TOUCH_KEY, captureFirstTouch, readFirstTouch } from "./first-touch";

const HOST = "fotosdocasamento.online";
beforeEach(() => localStorage.clear());
afterEach(() => { Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true }); });

describe("primeiro toque (atribuição)", () => {
  it("UTM da primeira visita fica guardada, sem dado pessoal", () => {
    captureFirstTouch({ search: "?utm_source=instagram&utm_medium=social&utm_campaign=lancamento", host: HOST }, "", 1000);
    expect(readFirstTouch()).toEqual({ source: "Instagram", medium: "social", campaign: "lancamento", at: 1000 });
    expect(Object.keys(JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY)!))).toEqual(["source", "medium", "campaign", "at"]);
  });
  it("visitas seguintes não sobrescrevem (primeiro toque)", () => {
    captureFirstTouch({ search: "?utm_source=instagram", host: HOST }, "", 1);
    captureFirstTouch({ search: "?utm_source=whatsapp&utm_medium=recuperacao", host: HOST }, "", 2);
    expect(readFirstTouch()?.source).toBe("Instagram");
  });
  it("sem UTM: usa a referência (buscador) ou fica 'direto'", () => {
    captureFirstTouch({ search: "", host: HOST }, "https://www.google.com/", 1);
    expect(readFirstTouch()).toMatchObject({ source: "Google", medium: "orgânico" });
    localStorage.clear();
    captureFirstTouch({ search: "", host: HOST }, "", 1);
    expect(readFirstTouch()).toMatchObject({ source: null, medium: "direto" });
  });
  it("respeita o 'não rastrear' do navegador", () => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    captureFirstTouch({ search: "?utm_source=instagram", host: HOST }, "", 1);
    expect(readFirstTouch()).toBeNull();
  });
  it("valor corrompido no armazenamento não quebra", () => {
    localStorage.setItem(FIRST_TOUCH_KEY, "{lixo");
    expect(readFirstTouch()).toBeNull();
  });
});
