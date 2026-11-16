import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const app = { user: { id: "u1", name: "Letícia Reiners", createdAt: 1 } as { id: string; name: string; createdAt: number } | undefined, signOut: vi.fn(async () => undefined), signInWithGoogle: vi.fn(async () => undefined), backend: "local" };
const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("@/features/app/provider", () => ({ useApp: () => app }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { email: "leticia@exemplo.com" } } }) } }) }));
vi.mock("@/components/revela", () => ({ Sheet: ({ title, children }: { title: string; children: React.ReactNode }) => <div role="dialog" aria-label={title}>{children}</div> }));
import { AccountMenu } from "./AccountMenu";

beforeEach(() => { app.user = { id: "u1", name: "Letícia Reiners", createdAt: 1 }; app.backend = "local"; vi.clearAllMocks(); });

describe("menu da conta na abertura", () => {
  it("sem usuário não aparece", () => {
    app.user = undefined;
    const { container } = render(<AccountMenu />);
    expect(container.textContent).toBe("");
  });
  it("mostra a conta, 'Trocar de conta' e 'Sair da conta'", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Conta de Letícia Reiners" }));
    expect(screen.getByRole("dialog", { name: "Sua conta" })).toBeTruthy();
    expect(screen.getByTestId("conta-trocar")).toBeTruthy();
    expect(screen.getByTestId("conta-sair")).toBeTruthy();
  });
  it("sair encerra a sessão e volta ao início", async () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByTestId("conta-abrir"));
    fireEvent.click(screen.getByTestId("conta-sair"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(app.signOut).toHaveBeenCalledOnce();
  });
  it("trocar de conta sai e abre o Google pedindo a escolha da conta", async () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByTestId("conta-abrir"));
    fireEvent.click(screen.getByTestId("conta-trocar"));
    await waitFor(() => expect(app.signInWithGoogle).toHaveBeenCalledWith("/", { chooseAccount: true }));
    expect(app.signOut).toHaveBeenCalledOnce();
  });
  it("na nuvem mostra o e-mail da conta", async () => {
    app.backend = "supabase";
    render(<AccountMenu />);
    fireEvent.click(screen.getByTestId("conta-abrir"));
    expect((await screen.findByTestId("conta-email")).textContent).toBe("leticia@exemplo.com");
  });
});
