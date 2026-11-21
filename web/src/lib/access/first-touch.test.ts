import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIRST_TOUCH_KEY, LAST_TOUCH_KEY, captureFirstTouch, inAppSource, readFirstTouch } from "./first-touch";

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
  it("último toque: YouTube primeiro, Instagram depois — os dois ficam; entrada direta não apaga o último", () => {
    captureFirstTouch({ search: "?utm_source=youtube&utm_medium=video", host: HOST }, "", 1);
    captureFirstTouch({ search: "?utm_source=instagram&utm_medium=social", host: HOST }, "", 2);
    captureFirstTouch({ search: "", host: HOST }, "", 3);
    expect(readFirstTouch()?.source).toBe("YouTube");
    expect(readFirstTouch(LAST_TOUCH_KEY)).toMatchObject({ source: "Instagram", at: 2 });
  });
  it("navegador interno do Instagram e do TikTok sem UTM e sem referência: origem pelo app", () => {
    const IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.0";
    const TT = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 trill_330 BytedanceWebview/d8a21c6 musical_ly_2023";
    captureFirstTouch({ search: "", host: HOST }, "", 1, IG);
    expect(readFirstTouch()).toMatchObject({ source: "Instagram", medium: "social" });
    localStorage.clear();
    captureFirstTouch({ search: "", host: HOST }, "", 1, TT);
    expect(readFirstTouch()).toMatchObject({ source: "TikTok", medium: "social" });
    expect(inAppSource("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBeNull();
  });
  it("UTM vence o app (link do vídeo com UTM aberto no Instagram)", () => {
    captureFirstTouch({ search: "?utm_source=tiktok&utm_campaign=video12", host: HOST }, "", 1, "Instagram 300");
    expect(readFirstTouch()).toMatchObject({ source: "TikTok", campaign: "video12" });
  });
  it("valor corrompido no armazenamento não quebra", () => {
    localStorage.setItem(FIRST_TOUCH_KEY, "{lixo");
    expect(readFirstTouch()).toBeNull();
  });
});
