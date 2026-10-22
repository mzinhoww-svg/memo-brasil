import { renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { useAlive } from "./use-alive";

describe("useAlive", () => {
  it("fica verdadeiro depois do ciclo montar→desmontar→montar do StrictMode (dev)", () => {
    const { result } = renderHook(() => useAlive(), { wrapper: StrictMode });
    expect(result.current.current).toBe(true);
  });
  it("vira falso só quando o componente sai de verdade", () => {
    const { result, unmount } = renderHook(() => useAlive());
    expect(result.current.current).toBe(true);
    unmount();
    expect(result.current.current).toBe(false);
  });
});
