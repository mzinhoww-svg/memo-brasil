import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getMyPhone: vi.fn(), setMyMarketing: vi.fn(), forgetMyPhone: vi.fn() }));
const env = vi.hoisted(() => ({ mode: "supabase" as "supabase" | "local" }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => env.mode }));
vi.mock("./contact", async () => {
  const real = await vi.importActual<typeof import("./contact")>("./contact");
  return { ...real, getMyPhone: api.getMyPhone, setMyMarketing: api.setMyMarketing, forgetMyPhone: api.forgetMyPhone };
});

import { formatBrPhone } from "./contact";
import { ContactPhoneRows } from "./ContactPhoneRows";
import { ConvidadoConsentimento } from "@/revela/screens/ConvidadoConsentimento";

beforeEach(() => {
  env.mode = "supabase";
  api.getMyPhone.mockReset().mockResolvedValue({ phone: "5565999990000", marketing: false });
  api.setMyMarketing.mockReset().mockResolvedValue(undefined);
  api.forgetMyPhone.mockReset().mockResolvedValue(undefined);
});

describe("número guardado na conta", () => {
  it("formata celular e fixo", () => {
    expect(formatBrPhone("5565999990000")).toBe("(65) 99999-0000");
    expect(formatBrPhone("556533221100")).toBe("(65) 3322-1100");
  });
  it("Você: mostra o número e liga/desliga novidades", async () => {
    render(<ContactPhoneRows />);
    expect(await screen.findByText("(65) 99999-0000")).toBeInTheDocument();
    const sw = screen.getByRole("switch", { name: /Novidades e ofertas/ });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await act(async () => { fireEvent.click(sw); });
    expect(api.setMyMarketing).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
  it("Você: apagar some com as linhas", async () => {
    const { container } = render(<ContactPhoneRows />);
    await screen.findByText("(65) 99999-0000");
    window.confirm = vi.fn(() => true);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Apagar" })); });
    expect(api.forgetMyPhone).toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
  it("sem número guardado ou fora da nuvem: não aparece", async () => {
    api.getMyPhone.mockResolvedValue(null);
    const a = render(<ContactPhoneRows />);
    await act(async () => {});
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();
    env.mode = "local";
    const b = render(<ContactPhoneRows />);
    await act(async () => {});
    expect(b.container).toBeEmptyDOMElement();
    expect(api.getMyPhone).toHaveBeenCalledTimes(1);
  });
  it("entrada: novidades é caixa própria, desmarcada, só quando há número", () => {
    const onCheck = vi.fn();
    const a = render(<ConvidadoConsentimento checked={[false, false]} marketing={{ checked: false, onCheck }} />);
    const box = screen.getByRole("checkbox", { name: /novidades e ofertas do Revela/ });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onCheck).toHaveBeenCalledWith(true);
    a.unmount();
    render(<ConvidadoConsentimento checked={[false, false]} />);
    expect(screen.queryByRole("checkbox", { name: /novidades/ })).not.toBeInTheDocument();
  });
});
