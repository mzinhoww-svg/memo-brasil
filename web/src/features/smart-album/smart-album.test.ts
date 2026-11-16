import { describe, expect, it, vi } from "vitest";
import { countBucket, sanitize, track } from "./analytics";
import { failureText, jobErrorText, referenceProblemText } from "./copy";
import { localFlags } from "./flags";
import { checkInput, countFaces, fetchGooglePicture, fitInside, googlePictureUrl, isHeic, problemFor } from "./reference";
import { createCloudSmartAlbum, createLocalSmartAlbum, LOCAL_CONSENT_VERSION, LOCAL_FAKE_MATCHES_KEY, parseAccountStatus, parseState, SmartAlbumError, toSmartAlbumError } from "./service";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const pngHead = (w: number, h: number) => {
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be(w), ...be(h), 8, 6, 0, 0, 0, 0, 0, 0, 0]);
};

describe("service · nuvem", () => {
  it("mapeia os códigos do servidor sem expor mensagem", () => {
    expect(toSmartAlbumError({ code: "MM019" }).code).toBe("disabled");
    expect(toSmartAlbumError({ code: "MM020" }).code).toBe("consent");
    expect(toSmartAlbumError({ code: "MM017" }).code).toBe("notrevealed");
    expect(toSmartAlbumError({ code: "42501" }).code).toBe("forbidden");
    expect(toSmartAlbumError(new Error("rede")).code).toBe("unavailable");
  });
  it("estado: valores desconhecidos viram padrão seguro (desligado)", () => {
    const s = parseState({ ui: "sim", face: { available: 1, profile: "hackeado", matches: "9" } });
    expect(s.ui).toBe(false);
    expect(s.face.available).toBe(false);
    expect(s.face.profile).toBeNull();
    expect(s.face.matches).toBeNull();
  });
  it("só chama RPCs com os parâmetros do contrato; nunca envia user id", async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === "smart_album_begin_account_reference") return { data: { bucket: "face-references", path: "conta/u/p" }, error: null };
      if (fn === "smart_album_list_matches") return { data: [{ photo_id: "f1", band: "probable", created_at: "2026-11-16T00:00:00Z" }], error: null };
      if (fn === "smart_album_revoke_account") return { data: { status: "purge_queued" }, error: null };
      return { data: null, error: null };
    });
    const upload = vi.fn(async () => ({ error: null }));
    const api = createCloudSmartAlbum(rpc, upload);
    await api.grantConsent("e", "v1", "camera");
    await api.uploadReference("e", "camera", new Blob(["x"], { type: "image/jpeg" }));
    expect(await api.matches("e")).toEqual([{ photoId: "f1", band: "probable", createdAt: Date.parse("2026-11-16T00:00:00Z") }]);
    expect(await api.revoke("e")).toEqual({ status: "purge_queued" });
    // aceite e selfie são da conta: não levam evento nem usuário
    expect(rpc).toHaveBeenCalledWith("smart_album_grant_account_consent", { p_version: "v1", p_source: "camera", p_self_attested: true });
    expect(rpc).toHaveBeenCalledWith("smart_album_begin_account_reference", { p_source: "camera" });
    expect(rpc).toHaveBeenCalledWith("smart_album_revoke_account", {});
    expect(upload).toHaveBeenCalledWith("face-references", "conta/u/p", expect.any(Blob));
    for (const c of rpc.mock.calls as unknown as [string, Record<string, unknown>][]) expect(Object.keys(c[1] ?? {})).not.toContain("p_user");
  });
  it("status da conta: só campos conhecidos, datas validadas", () => {
    expect(parseAccountStatus({ available: true, account: true, consentVersion: "v2", consented: true, consentedAt: "2026-11-16T00:00:00Z", profile: "ready", referenceAt: "lixo" }))
      .toEqual({ available: true, account: true, consentVersion: "v2", consented: true, consentOutdated: false, consentedAt: Date.parse("2026-11-16T00:00:00Z"), profile: "ready", referenceAt: null });
  });
  it("estado por evento: escopo do aceite e organizador que desligou", () => {
    const s = parseState({ face: { available: false, consented: true, scope: "account", hostDisabled: true, consentedAt: "2026-11-16T00:00:00Z" } });
    expect(s.face.scope).toBe("account");
    expect(s.face.hostDisabled).toBe(true);
    expect(parseState({ face: { scope: "global" } }).face.scope).toBeNull();
  });
  it("recusa caminho de upload fora do bucket privado", async () => {
    const api = createCloudSmartAlbum(async () => ({ data: { bucket: "event-photos", path: "x" }, error: null }), vi.fn());
    await expect(api.uploadReference("e", "upload", new Blob(["x"]))).rejects.toMatchObject({ code: "unavailable" });
  });
  it("erro de RPC vira SmartAlbumError tipado", async () => {
    const api = createCloudSmartAlbum(async () => ({ data: null, error: { code: "MM019", message: "facedisabled" } }));
    await expect(api.grantConsent("e", "v", "upload")).rejects.toBeInstanceOf(SmartAlbumError);
    await expect(api.matches("e")).rejects.toMatchObject({ code: "disabled" });
  });
});

describe("service · local", () => {
  const ctx = (over: Partial<Parameters<typeof createLocalSmartAlbum>[1]> = {}) => ({
    ui: true, face: false, revealed: () => true, canSee: (id: string) => id !== "oculta", eventOf: (id: string) => (id.startsWith("x") ? undefined : "e1"), ...over,
  });
  it("chave desligada: álbum recusa e busca indisponível", async () => {
    const api = createLocalSmartAlbum({ id: "u" }, ctx({ ui: false }), mem());
    await expect(api.setItem("f1", "favorite", true)).rejects.toMatchObject({ code: "disabled" });
    expect((await api.state("e1")).face.available).toBe(false);
  });
  it("favoritas só de fotos visíveis e do evento; lista filtra o que deixou de ser visível", async () => {
    const s = mem();
    let hidden = false;
    const api = createLocalSmartAlbum({ id: "u" }, ctx({ canSee: (id) => id !== "oculta" && !(hidden && id === "f1") }), s);
    await api.setItem("f1", "favorite", true);
    await expect(api.setItem("oculta", "favorite", true)).rejects.toMatchObject({ code: "forbidden" });
    await expect(api.setItem("x-outro", "favorite", true)).rejects.toMatchObject({ code: "forbidden" });
    expect((await api.items("e1")).map((i) => i.photoId)).toEqual(["f1"]);
    hidden = true;
    expect(await api.items("e1")).toEqual([]);
  });
  it("busca simulada: sem chave de face não consente; anônimo não consente", async () => {
    await expect(createLocalSmartAlbum({ id: "u" }, ctx(), mem()).grantConsent("e1", LOCAL_CONSENT_VERSION, "upload")).rejects.toMatchObject({ code: "disabled" });
    await expect(createLocalSmartAlbum({ id: "u", anonymous: true }, ctx({ face: true }), mem()).grantConsent("e1", LOCAL_CONSENT_VERSION, "upload")).rejects.toMatchObject({ code: "disabled" });
  });
  it("busca simulada: ordem consentimento → referência → busca; revelação; filtro de visibilidade; ocultar; revogar", async () => {
    const s = mem();
    s.setItem(LOCAL_FAKE_MATCHES_KEY, JSON.stringify({ e1: ["f1", "oculta", "f2"] }));
    let revealed = false;
    const api = createLocalSmartAlbum({ id: "u" }, ctx({ face: true, revealed: () => revealed }), s);
    await expect(api.uploadReference("e1", "upload", new Blob(["x"]))).rejects.toMatchObject({ code: "consent" });
    await api.grantConsent("e1", LOCAL_CONSENT_VERSION, "upload");
    await api.uploadReference("e1", "upload", new Blob(["x"]));
    await expect(api.requestSearch("e1", "k")).rejects.toMatchObject({ code: "notrevealed" });
    revealed = true;
    await api.requestSearch("e1", "k");
    expect((await api.matches("e1")).map((m) => m.photoId)).toEqual(["f1", "f2"]); // "oculta" nunca sai
    await api.hideMatch("e1", "f1");
    expect((await api.matches("e1")).map((m) => m.photoId)).toEqual(["f2"]);
    expect(await api.revoke("e1")).toEqual({ status: "purge_queued" });
    await expect(api.matches("e1")).rejects.toMatchObject({ code: "consent" });
    expect(await api.revoke("e1")).toEqual({ status: "done" });
  });
  it("a imagem de referência nunca é gravada no aparelho", async () => {
    const s = mem();
    const api = createLocalSmartAlbum({ id: "u" }, ctx({ face: true }), s);
    await api.grantConsent("e1", LOCAL_CONSENT_VERSION, "camera");
    await api.uploadReference("e1", "camera", new Blob(["BYTES-DA-REFERENCIA"], { type: "image/jpeg" }));
    expect([...s.m.values()].join("")).not.toContain("BYTES-DA-REFERENCIA");
  });
});

describe("reference", () => {
  it("valida pelo conteúdo, não pelo nome", () => {
    expect(checkInput(pngHead(800, 800))).toBeNull();
    expect(checkInput(new TextEncoder().encode("<svg/>"))).toBe("unsupported");
    expect(checkInput(new Uint8Array(15 * 1024 * 1024 + 1))).toBe("too-large");
    const heic = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);
    expect(isHeic(heic)).toBe(true);
    expect(checkInput(heic)).toBeNull();
  });
  it("redimensiona mantendo a proporção e nunca amplia", () => {
    expect(fitInside(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitInside(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("problemas: pequena, sem rosto, vários rostos; detector ausente não bloqueia", () => {
    expect(problemFor(300, 900, "one")).toBe("too-small");
    expect(problemFor(800, 800, "none")).toBe("no-face");
    expect(problemFor(800, 800, "many")).toBe("many-faces");
    expect(problemFor(800, 800, "unchecked")).toBeNull();
  });
  it("conta rostos com o detector do navegador quando existe", async () => {
    const src = {} as CanvasImageSource;
    expect(await countFaces(src, () => null)).toBe("unchecked");
    expect(await countFaces(src, () => ({ detect: async () => [] }))).toBe("none");
    expect(await countFaces(src, () => ({ detect: async () => [{}] }))).toBe("one");
    expect(await countFaces(src, () => ({ detect: async () => [{}, {}] }))).toBe("many");
    expect(await countFaces(src, () => ({ detect: async () => { throw new Error("x"); } }))).toBe("unchecked");
  });
  it("foto do Google: só HTTPS em googleusercontent.com, pedida em tamanho maior", () => {
    expect(googlePictureUrl({ picture: "https://lh3.googleusercontent.com/a/abc=s96-c" })).toBe("https://lh3.googleusercontent.com/a/abc=s640-c");
    expect(googlePictureUrl({ avatar_url: "https://lh3.googleusercontent.com/a/x" })).toBe("https://lh3.googleusercontent.com/a/x");
    expect(googlePictureUrl({ picture: "http://lh3.googleusercontent.com/a/x" })).toBeNull();
    expect(googlePictureUrl({ picture: "https://evil.com/googleusercontent.com/x" })).toBeNull();
    expect(googlePictureUrl({ picture: "https://googleusercontent.com.evil.com/x" })).toBeNull();
    expect(googlePictureUrl({ picture: "https://user:pw@lh3.googleusercontent.com/x" })).toBeNull();
    expect(googlePictureUrl({ picture: "https://169.254.169.254/latest" })).toBeNull();
    expect(googlePictureUrl(null)).toBeNull();
  });
  it("baixa a foto do Google sem credenciais, sem redirecionar, com teto", async () => {
    const fetchFn = vi.fn(async () => new Response(new Blob(["img"]), { status: 200 }));
    await fetchGooglePicture("https://lh3.googleusercontent.com/a/x", fetchFn as never);
    expect((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]).toMatchObject({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
    expect(await fetchGooglePicture("https://evil.com/x", fetchFn as never)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const big = vi.fn(async () => new Response("x", { status: 200, headers: { "content-length": String(16 * 1024 * 1024) } }));
    expect(await fetchGooglePicture("https://lh3.googleusercontent.com/a/x", big as never)).toBeNull();
    expect(await fetchGooglePicture("https://lh3.googleusercontent.com/a/x", (async () => { throw new Error("cors"); }) as never)).toBeNull();
  });
});

describe("flags locais", () => {
  it("variável de build vale; localStorage só em build de homologação", () => {
    expect(localFlags("face", false, undefined)).toEqual({ ui: true, face: true });
    expect(localFlags("ui", false, undefined)).toEqual({ ui: true, face: false });
    expect(localFlags(undefined, false, { getItem: () => "face" })).toEqual({ ui: false, face: false });
    expect(localFlags(undefined, true, { getItem: () => "face" })).toEqual({ ui: true, face: true });
    expect(localFlags(undefined, true, { getItem: () => "qualquer" })).toEqual({ ui: false, face: false });
  });
});

describe("analytics", () => {
  it("descarta propriedades fora da lista (sem PII, sem ids)", () => {
    expect(sanitize({ source: "gallery", userId: "u1", email: "a@b.c", photoId: "f1", url: "https://x", reason: "Nome Próprio" })).toEqual({ source: "gallery" });
    expect(countBucket(0)).toBe("0");
    expect(countBucket(7)).toBe("6-20");
  });
  it("emite CustomEvent com nome e props filtradas", () => {
    const dispatchEvent = vi.fn(() => true);
    track("smart_album_source_selected", { source: "camera", name: "Ana" }, { dispatchEvent });
    expect((dispatchEvent.mock.calls[0] as unknown as [CustomEvent])[0].detail).toEqual({ name: "smart_album_source_selected", props: { source: "camera" } });
  });
});

describe("copy", () => {
  it("toda falha e problema tem texto, sem prometer certeza", () => {
    for (const c of ["disabled", "consent", "notrevealed", "forbidden", "invalid", "rate-limited", "unavailable"] as const) expect(failureText(c).length).toBeGreaterThan(10);
    for (const p of ["too-large", "unsupported", "undecodable", "too-small", "no-face", "many-faces"] as const) expect(referenceProblemText(p).length).toBeGreaterThan(10);
    expect(jobErrorText("no_face")).toContain("rosto");
    expect(jobErrorText(null)).toContain("Tente de novo");
  });
});
