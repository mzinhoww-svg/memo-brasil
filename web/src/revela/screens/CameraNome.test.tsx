// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CameraNome } from "./CameraNome";
afterEach(cleanup);
it("a prévia escreve o nome digitado na faixa da embalagem (ou o nome-exemplo se vazio)", () => {
  const { container, rerender } = render(<CameraNome wrap="aniversario" name="Festa de Aurimar" keyboard={false} onName={() => {}} />);
  expect(container.querySelector(".namepreview__band")?.textContent).toBe("Festa de Aurimar");
  rerender(<CameraNome wrap="aniversario" name="" keyboard={false} onName={() => {}} />);
  expect(container.querySelector(".namepreview__band")?.textContent).toBe("Nome do evento");
  expect(screen.getByAltText("Embalagem com o nome do evento")).toBeTruthy();
});
