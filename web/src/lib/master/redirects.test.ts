import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("páginas antigas do Master: redireções permanentes", () => {
  it("cada rota antiga aponta para a aba ou tela que a absorveu (308)", async () => {
    const r = await nextConfig.redirects!();
    const to = Object.fromEntries(r.map((x) => [x.source, x]));
    const expected: Record<string, string> = {
      "/master/usuarios": "/master/pessoas?aba=contas",
      "/master/organizadores": "/master/pessoas?aba=organizadores",
      "/master/participantes": "/master/pessoas?aba=convidados",
      "/master/storage": "/master/saude",
      "/master/analytics": "/master",
    };
    for (const [src, dest] of Object.entries(expected)) {
      expect(to[src]?.destination, src).toBe(dest);
      expect(to[src]?.permanent, src).toBe(true);
    }
  });
});
