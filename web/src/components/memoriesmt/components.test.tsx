import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AdminNav, Button, Chip, CountBadge, DataList, Field, Icon, Logo, Notice, OptionGroup, PostCard, Progress, Stepper, TabBar, Tabs,
} from ".";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

describe("Button", () => {
  it("é <button> com type=button e aplica as classes do kit", () => {
    render(<Button variant="secundario">Entrar na festa</Button>);
    const b = screen.getByRole("button", { name: "Entrar na festa" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveClass("mm-btn", "mm-btn--secundario");
  });
  it("desabilitado usa o atributo disabled", () => {
    render(<Button disabled>Postar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("com href vira link; CTA XL combina cta + cta-xl", () => {
    render(<Button href="/e/X" variant="cta-xl" icon="camera">Postar daqui</Button>);
    const a = screen.getByRole("link", { name: "Postar daqui" });
    expect(a).toHaveClass("mm-btn--cta", "mm-btn--cta-xl");
    expect(a.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Field", () => {
  it("liga rótulo e campo; erro marca aria-invalid e aria-describedby", () => {
    render(<Field label="Código da festa" code error="Código não confere. Confira no card da mesa." help="8 caracteres" defaultValue="" />);
    const input = screen.getByLabelText("Código da festa");
    expect(input).toHaveClass("mm-field-input--codigo");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0])).toHaveTextContent("Código não confere.");
  });
});

describe("Chip, OptionGroup, Stepper", () => {
  it("Chip expõe aria-pressed e conta em pt-BR", async () => {
    const onClick = vi.fn();
    render(<Chip pressed count={1284} onClick={onClick}>Amei</Chip>);
    const chip = screen.getByRole("button");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveTextContent("Amei 1.284");
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalled();
  });
  it("OptionGroup marca a opção atual e dispara onChange", async () => {
    const onChange = vi.fn();
    render(<OptionGroup label="Fotos por pessoa" options={[{ value: 10, label: "10" }, { value: null, label: "Ilimitadas" }]} value={10} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "10" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Ilimitadas" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it("Stepper respeita limites e usa zero à esquerda", async () => {
    const onChange = vi.fn();
    render(<Stepper label="Mesa" value={8} min={1} max={9} onChange={onChange} decrementLabel="Mesa anterior" incrementLabel="Próxima mesa" />);
    expect(screen.getByText("08")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Próxima mesa" }));
    expect(onChange).toHaveBeenCalledWith(9);
  });
});

describe("Tabs", () => {
  it("usa tablist/tab, aria-selected e anda com as setas", async () => {
    const onChange = vi.fn();
    render(<Tabs base="mod" label="Filas" tabs={[{ id: "a", label: "Pedidos de remoção", count: 3 }, { id: "b", label: "Ocultas" }]} value="a" onChange={onChange} />);
    expect(screen.getByRole("tablist", { name: "Filas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pedidos de remoção · 3" })).toHaveAttribute("aria-selected", "true");
    screen.getByRole("tab", { name: /Pedidos/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("TabBar e AdminNav", () => {
  it("marca a aba atual com aria-current e mantém o CTA acima", () => {
    render(<TabBar cta={{ href: "/postar", label: "Postar daqui" }} items={[{ href: "/a", label: "Agora", icon: "agora", current: true }, { href: "/e", label: "Explorar", icon: "explorar" }, { href: "/v", label: "Você", icon: "voce" }]} />);
    expect(screen.getByRole("link", { name: "Agora" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Postar daqui" })).toHaveClass("mm-btn--cta");
    expect(within(screen.getByRole("navigation", { name: "Navegação principal" })).getAllByRole("link")).toHaveLength(3);
  });
  it("AdminNav mostra contador só quando há pendência", () => {
    render(<AdminNav eventName="Emy e Igor" eventState="ao vivo" switchHref="/" items={[{ href: "#c", label: "Conteúdo", current: true, count: 3 }, { href: "#v", label: "Visão geral", count: 0 }]} />);
    expect(screen.getByLabelText("3 pendentes")).toBeInTheDocument();
    expect(screen.queryByLabelText("0 pendentes")).toBeNull();
  });
});

describe("Icon, Logo, CountBadge, Progress, Notice, DataList, PostCard", () => {
  it("Icon com label vira img; decorativo some para leitores de tela", () => {
    render(<><Icon name="sem-sinal" label="Sem sinal" /><Icon name="camera" decorative /></>);
    expect(screen.getByRole("img", { name: "Sem sinal" })).toBeInTheDocument();
    expect(document.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(1);
  });
  it("Logo respeita o mínimo do kit (wordmark 96px, selo 16px)", () => {
    const { container } = render(<><Logo variant="wordmark" size={40} /><Logo variant="selo" size={8} /></>);
    const imgs = container.querySelectorAll("img");
    expect(imgs[0]).toHaveAttribute("width", "96");
    expect(imgs[2]).toHaveAttribute("width", "16");
  });
  it("CountBadge some em zero", () => {
    const { container } = render(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("Progress de envio expõe progressbar com valor limitado a 0–100", () => {
    render(<Progress label="Foto 2" status="62%" value={162} />);
    expect(screen.getByRole("progressbar", { name: "Foto 2" })).toHaveAttribute("aria-valuenow", "100");
  });
  it("Notice avisa como status", () => {
    render(<Notice text="Pôr do sol na areia em 10 minutos." />);
    expect(screen.getByRole("status")).toHaveTextContent("Pôr do sol");
  });
  it("DataList realça alerta com nota", () => {
    const { container } = render(<DataList head={["Mesas", "Fotos"]} rows={[{ key: "m12", name: "Mesa 12", kind: "mesa", value: "12", alert: true }]} note="Vale um aviso." />);
    expect(container.querySelector(".mm-row-valor--alerta")).toHaveTextContent("12");
    expect(screen.getByText("Vale um aviso.")).toBeInTheDocument();
  });
  it("PostCard traz botão de mais opções citando a remoção e foto com alt", () => {
    render(<PostCard vision="Visão da Mesa 8" meta="Pôr do sol · há 2 min" avatar="M8" imageSrc="/x.jpg" alt="Foto da Mesa 8" tag="Escolha dos noivos" />);
    expect(screen.getByRole("button", { name: /pedir para remover/ })).toBeInTheDocument();
    expect(screen.getByAltText("Foto da Mesa 8")).toBeInTheDocument();
    expect(screen.getByText("Escolha dos noivos")).toHaveClass("mm-tag");
  });
});
