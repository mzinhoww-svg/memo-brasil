import { describe, expect, it } from "vitest";
import { decideMasterAccess } from "./access";

const master = { is_anonymous: false, app_metadata: { role: "master" } };
describe("decideMasterAccess", () => {
  it("sem Supabase não há console: modo local", () => {
    expect(decideMasterAccess({ backend: "local", user: master, rpcIsMaster: true })).toBe("local");
    expect(decideMasterAccess({ backend: "misconfigured", user: master, rpcIsMaster: true })).toBe("local");
  });
  it("sem sessão ou com sessão anônima pede login", () => {
    expect(decideMasterAccess({ backend: "supabase", user: null, rpcIsMaster: null })).toBe("anonymous");
    expect(decideMasterAccess({ backend: "supabase", user: { is_anonymous: true, app_metadata: {} }, rpcIsMaster: false })).toBe("anonymous");
  });
  it("organizador comum é negado, mesmo com o RPC verdadeiro por engano", () => {
    expect(decideMasterAccess({ backend: "supabase", user: { is_anonymous: false, app_metadata: { role: "host" } }, rpcIsMaster: true })).toBe("forbidden");
    expect(decideMasterAccess({ backend: "supabase", user: { is_anonymous: false, app_metadata: {} }, rpcIsMaster: false })).toBe("forbidden");
  });
  it("claim sem linha ativa em platform_roles (RPC falso ou ausente) é negado", () => {
    expect(decideMasterAccess({ backend: "supabase", user: master, rpcIsMaster: false })).toBe("forbidden");
    expect(decideMasterAccess({ backend: "supabase", user: master, rpcIsMaster: null })).toBe("forbidden");
  });
  it("só claim E papel ativo no banco liberam o console", () => {
    expect(decideMasterAccess({ backend: "supabase", user: master, rpcIsMaster: true })).toBe("ok");
  });
});
