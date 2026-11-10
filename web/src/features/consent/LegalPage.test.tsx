import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LegalPage, isDraftVersion } from "./LegalPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

const sections = [{ title: "1. Quem somos", blocks: ["Texto."] }];

describe("LegalPage", () => {
  it("LegalPage sem banner quando versão não termina em -rascunho", () => {
    render(<LegalPage title="Termos de uso" kind="terms" sections={sections} />);
    expect(screen.queryByText(/rascunho/i)).toBeNull();
  });
  it("mostra o banner quando a versão termina em -rascunho", () => {
    render(<LegalPage title="Termos de uso" kind="terms" sections={sections} version="2026-11-01-rascunho" />);
    expect(screen.getByRole("note")).toHaveTextContent(/rascunho/i);
  });
  it("isDraftVersion", () => {
    expect(isDraftVersion("2026-10-22-v1")).toBe(false);
    expect(isDraftVersion("2026-10-22-rascunho")).toBe(true);
  });
});
