// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clock, ReconcileSheet, useReconcile, type UseReconcileArgs } from "./ReconcileSheet";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Harness(p: UseReconcileArgs) {
  const r = useReconcile(p);
  return (
    <>
      <button onClick={() => void r.start()}>abrir</button>
      {r.state && <ReconcileSheet state={r.state} onSubmitCode={(c) => void r.submitCode(c)} onClose={r.close} inline />}
    </>
  );
}
const ok = { kind: "ok" as const, confirmed: 12, failed: 1 };

describe("ReconcileSheet: código do autenticador", () => {
  it("sem aal2 pede o código; o botão só liga com 6 números", async () => {
    render(<Harness hasSecondFactor={async () => false} verifyCode={async () => "ok"} reconcile={async () => ok} />);
    fireEvent.click(screen.getByText("abrir"));
    expect(await screen.findByText("Código do app autenticador")).toBeTruthy();
    expect(screen.getByText(/Esta sessão ainda não confirmou o segundo fator/)).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Conciliar" }) as HTMLButtonElement;
    const input = screen.getByLabelText("Código do app autenticador");
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "30512" } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "30a5 12" } });
    expect((input as HTMLInputElement).value).toBe("30512");
    fireEvent.change(input, { target: { value: "305123" } });
    expect(btn.disabled).toBe(false);
  });
  it("código errado mostra o erro e continua pedindo", async () => {
    const reconcile = vi.fn(async () => ok);
    render(<Harness hasSecondFactor={async () => false} verifyCode={async () => "wrong"} reconcile={reconcile} />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.change(await screen.findByLabelText("Código do app autenticador"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Conciliar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Código incorreto. Tente de novo.");
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("sem autenticador cadastrado avisa", async () => {
    render(<Harness hasSecondFactor={async () => false} verifyCode={async () => "no-factor"} reconcile={async () => ok} />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.change(await screen.findByLabelText("Código do app autenticador"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Conciliar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Cadastre o autenticador/);
  });
  it("código certo concilia e mostra o resultado com a próxima liberação", async () => {
    const onDone = vi.fn();
    render(<Harness hasSecondFactor={async () => false} verifyCode={async () => "ok"} reconcile={async () => ok} onDone={onDone} />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.change(await screen.findByLabelText("Código do app autenticador"), { target: { value: "305123" } });
    fireEvent.click(screen.getByRole("button", { name: "Conciliar" }));
    expect(await screen.findByRole("dialog", { name: "Conciliação concluída" })).toBeTruthy();
    expect(screen.getByText("Conciliados").nextSibling?.textContent).toBe("12");
    expect(screen.getByText("Falhas").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("Sem mudança").nextSibling?.textContent).toBe("—");
    expect(screen.getByText("Próxima conciliação manual liberada em 01:00.")).toBeTruthy();
    expect(onDone).toHaveBeenCalled();
  });
  it("com aal2 já confirmado pula o código e concilia direto", async () => {
    const reconcile = vi.fn(async () => ({ kind: "ok" as const, confirmed: 0, failed: 0 }));
    render(<Harness hasSecondFactor={async () => true} reconcile={reconcile} />);
    fireEvent.click(screen.getByText("abrir"));
    expect(await screen.findByRole("dialog", { name: "Conciliação concluída" })).toBeTruthy();
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Código do app autenticador")).toBeNull();
  });
  it("sessão que perdeu o aal2 (stepup do servidor) volta a pedir o código", async () => {
    render(<Harness hasSecondFactor={async () => true} reconcile={async () => ({ kind: "stepup" })} />);
    fireEvent.click(screen.getByText("abrir"));
    expect(await screen.findByText("Código do app autenticador")).toBeTruthy();
  });
  it("sem permissão e indisponível mostram a mensagem", async () => {
    const { unmount } = render(<Harness hasSecondFactor={async () => true} reconcile={async () => ({ kind: "forbidden" })} />);
    fireEvent.click(screen.getByText("abrir"));
    expect(await screen.findByText("Sem permissão para conciliar.")).toBeTruthy();
    unmount();
    render(<Harness hasSecondFactor={async () => true} reconcile={async () => ({ kind: "unavailable" })} />);
    fireEvent.click(screen.getByText("abrir"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/rotina automática confirma em até 5 minutos/);
  });
});

describe("ReconcileSheet: espera de 1 minuto", () => {
  beforeEach(() => vi.useFakeTimers());
  it("o servidor recusa (uma por minuto): mostra a espera com contagem regressiva a cada segundo", async () => {
    let t = 1_000_000;
    render(<Harness hasSecondFactor={async () => true} reconcile={async () => ({ kind: "ratelimited" })} last="hoje 08:51, por marcos@revela.app" now={() => t} />);
    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("dialog", { name: "Aguarde um pouco" })).toBeTruthy();
    expect(screen.getByText("A conciliação manual só pode rodar uma vez por minuto.")).toBeTruthy();
    expect(screen.getByText("Última: hoje 08:51, por marcos@revela.app. A conciliação automática continua rodando.")).toBeTruthy();
    const timer = () => screen.getByRole("timer").textContent;
    expect(timer()).toBe("01min00seg");
    t += 18_000;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(timer()).toBe("00min42seg");
    t += 41_000;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(timer()).toBe("00min01seg");
    t += 5_000;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(timer()).toBe("00min00seg");
  });
  it("depois do resultado a mensagem 'liberada em' também conta para trás", async () => {
    let t = 5_000_000;
    render(<Harness hasSecondFactor={async () => true} reconcile={async () => ok} now={() => t} />);
    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Próxima conciliação manual liberada em 01:00.")).toBeTruthy();
    t += 3_000;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText("Próxima conciliação manual liberada em 00:57.")).toBeTruthy();
    t += 57_000;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByText(/Próxima conciliação manual/)).toBeNull();
  });
});

describe("clock", () => {
  it("formata mm:ss", () => {
    expect(clock(57)).toBe("00:57");
    expect(clock(60)).toBe("01:00");
    expect(clock(-3)).toBe("00:00");
  });
  it("renderHook: fechar volta ao nada", async () => {
    const { result } = renderHook(() => useReconcile({ hasSecondFactor: async () => false }));
    await act(async () => { await result.current.start(); });
    expect(result.current.state?.step).toBe("code");
    act(() => result.current.close());
    expect(result.current.state).toBeNull();
    await waitFor(() => expect(result.current.state).toBeNull());
  });
});
