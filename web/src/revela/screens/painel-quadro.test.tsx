import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import { PainelFrame } from "@/components/revela/PainelFrame";
import { PainelResumo } from "./PainelResumo";
import { QRConvite } from "./QRConvite";

const frame = (title: string, ui: React.ReactNode) => <PainelFrame title={title} eventName="Ana & Leo" backHref="/painel/e1">{ui}</PainelFrame>;
const foot = (c: HTMLElement) => c.querySelector<HTMLElement>(".pf-foot")!;

describe("telas do desenho dentro do quadro do painel: título único e sem cabeçalho repetido", () => {
  it("QRConvite: sem seta própria, 'Modelo X de N' e Proporção ficam, o botão vai para o rodapé fixo", () => {
    const onDownload = vi.fn();
    const { container } = render(frame("QR para as mesas", <QRConvite onDownload={onDownload} />));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
    expect(screen.getByText("Modelo 2 de 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Proporção/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Modelos do cartão de mesa" })).toBeInTheDocument();
    const download = within(foot(container)).getByRole("button", { name: /Baixar QR code/ });
    download.click();
    expect(onDownload).toHaveBeenCalledWith(2);
  });

  it("QRConvite fora do quadro mantém o desenho: seta Fechar e o botão no fim da tela", () => {
    const { container } = render(<QRConvite />);
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(container.querySelector(".scr .safe")?.lastElementChild).toContainElement(screen.getByRole("button", { name: /Baixar QR code/ }));
  });

  it("PainelResumo: a ação Ajustes sobe para o cabeçalho do quadro; o nome do evento é o h1 do quadro, sem h1 repetido", () => {
    const { container } = render(frame("Ana & Leo", <PainelResumo settingsHref="/painel/e1/configuracoes" />));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Voltar" })).toHaveLength(1);
    const ajustes = screen.getByRole("link", { name: "Ajustes" });
    expect(container.querySelector(".pf-action")).toContainElement(ajustes);
    expect(screen.getByText("Convidados", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Painel" })).toBeInTheDocument();
  });

  it("PainelResumo fora do quadro mantém o cabeçalho do desenho (seta, h1 com o nome, Ajustes)", () => {
    render(<PainelResumo name="Ana & Leo" settingsHref="/x" />);
    expect(screen.getByRole("heading", { level: 1, name: "Ana & Leo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustes" })).toBeInTheDocument();
  });
});
