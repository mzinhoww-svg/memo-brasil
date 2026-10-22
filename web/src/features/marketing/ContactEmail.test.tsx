import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getPublicSettings: vi.fn() }));
vi.mock("@/features/billing/api", () => api);
import { CONTACT_EMAIL } from "@/lib/contact";
import { ContactEmail } from "./ContactEmail";
beforeEach(() => api.getPublicSettings.mockReset());
describe("ContactEmail", () => {
  it("usa o e-mail do servidor quando preenchido", async () => {
    api.getPublicSettings.mockResolvedValue({ supportEmail: "oi@memoriesmt.test" });
    render(<ContactEmail />);
    expect(await screen.findByRole("link", { name: "oi@memoriesmt.test" })).toBeInTheDocument();
  });
  it("cai no padrão quando vazio", async () => {
    api.getPublicSettings.mockResolvedValue({ supportEmail: null });
    const { unmount } = render(<ContactEmail />);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByRole("link", { name: CONTACT_EMAIL })).toBeInTheDocument();
    unmount();
  });
});
