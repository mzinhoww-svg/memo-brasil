import { describe, expect, it, vi } from "vitest";
import { CommentError, COMMENT_MAX, commentAgo, commentFailureText, createCloudComments, createLocalComments, toCommentError } from "./service";

describe("erros dos comentários", () => {
  it("traduz os códigos do servidor (MM016, MM017, MM018 e os comuns)", () => {
    expect(toCommentError({ code: "MM016" }).code).toBe("stepup");
    expect(toCommentError({ code: "MM017" }).code).toBe("notrevealed");
    expect(toCommentError({ code: "MM018" }).code).toBe("consentrequired");
    expect(toCommentError({ code: "MM019" }).code).toBe("disabled");
    expect(toCommentError({ code: "MM004" }).code).toBe("forbidden");
    expect(toCommentError({ code: "MM005" }).code).toBe("invalid");
    expect(toCommentError({ code: "MM006" }).code).toBe("rate-limited");
    expect(toCommentError(new Error("rede")).code).toBe("unavailable");
  });
  it("cada falha tem um texto para a pessoa", () => {
    expect(commentFailureText("notrevealed")).toMatch(/reveladas/);
    expect(commentFailureText("invalid")).toContain(String(COMMENT_MAX));
    expect(commentFailureText("unavailable")).toMatch(/Tente de novo/);
  });
});

describe("comentários na nuvem (RPCs)", () => {
  it("consulta a chave efetiva e informa pausa sem tratar como falha de rede",async()=>{
    const rpc=vi.fn(async()=>({data:{commentsEnabled:false},error:null}));
    expect(await createCloudComments(rpc).enabled?.()).toBe(false);
    expect(rpc).toHaveBeenCalledWith("get_revela_features",{});
    expect(commentFailureText("disabled")).toContain("desativados");
  });
  it("publica com o texto aparado e devolve o erro tipado do servidor", async () => {
    const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => (fn === "post_comment" && args?.p_body === "oi" ? { data: { id: "1" }, error: null } : { data: null, error: { code: "MM017", message: "notrevealed" } }));
    const api = createCloudComments(rpc);
    await api.post("p1", "  oi  ");
    expect(rpc).toHaveBeenCalledWith("post_comment", { p_photo: "p1", p_body: "oi" });
    await expect(api.list("p1")).rejects.toMatchObject({ code: "notrevealed" });
    await expect(api.post("p1", "   ")).rejects.toBeInstanceOf(CommentError);
    await expect(api.post("p1", "x".repeat(COMMENT_MAX + 1))).rejects.toMatchObject({ code: "invalid" });
  });
  it("lista converte as linhas e a contagem vem por foto", async () => {
    const rpc = vi.fn(async (fn: string) => fn === "comment_counts"
      ? { data: { p1: 2 }, error: null }
      : { data: [{ id: "c1", photoId: "p1", authorId: "u1", authorName: "Ana", body: "oi", likes: 3, likedByMe: true, mine: false, createdAt: "2027-03-14T22:41:00Z" }], error: null });
    const api = createCloudComments(rpc);
    expect(await api.counts("e1")).toEqual({ p1: 2 });
    const [c] = await api.list("p1");
    expect(c).toMatchObject({ id: "c1", authorName: "Ana", likes: 3, likedByMe: true, mine: false, createdAt: Date.parse("2027-03-14T22:41:00Z") });
  });
});

describe("comentários locais", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("exige a revelação, 1 a 280 caracteres, curtida única e 3 denúncias escondem", async () => {
    const store = mem();
    let revealed = false;
    const ana = createLocalComments({ id: "a", name: "Ana" }, { revealed: () => revealed, eventOf: () => "e1" }, store);
    await expect(ana.post("p1", "oi")).rejects.toMatchObject({ code: "notrevealed" });
    revealed = true;
    await expect(ana.post("p1", "")).rejects.toMatchObject({ code: "invalid" });
    await ana.post("p1", "primeiro");
    const [c] = await ana.list("p1");
    expect(c).toMatchObject({ body: "primeiro", mine: true, likes: 0 });
    expect(await ana.counts("e1")).toEqual({ p1: 1 });
    expect(await ana.toggleLike(c.id)).toEqual({ liked: true, likes: 1 });
    expect(await ana.toggleLike(c.id)).toEqual({ liked: false, likes: 0 });
    await expect(ana.report(c.id)).rejects.toMatchObject({ code: "invalid" }); // não denuncia o próprio
    for (const u of ["x", "y", "z"]) await createLocalComments({ id: u, name: u }, { revealed: () => true, eventOf: () => "e1" }, store).report(c.id);
    expect(await ana.counts("e1")).toEqual({});
  });
  it("só o autor apaga o próprio comentário", async () => {
    const store = mem();
    const ctx = { revealed: () => true, eventOf: () => "e1" };
    const ana = createLocalComments({ id: "a", name: "Ana" }, ctx, store);
    await ana.post("p1", "oi");
    const [c] = await ana.list("p1");
    await expect(createLocalComments({ id: "b", name: "Bia" }, ctx, store).remove(c.id)).rejects.toMatchObject({ code: "forbidden" });
    await ana.remove(c.id);
    expect(await ana.list("p1")).toEqual([]);
  });
});

describe("commentAgo", () => {
  it("agora, minutos, horas, dias", () => {
    const n = 10_000_000_000;
    expect(commentAgo(n - 10_000, n)).toBe("agora");
    expect(commentAgo(n - 120_000, n)).toBe("2 min");
    expect(commentAgo(n - 3 * 3_600_000, n)).toBe("3 h");
    expect(commentAgo(n - 5 * 86_400_000, n)).toBe("5 d");
  });
});
