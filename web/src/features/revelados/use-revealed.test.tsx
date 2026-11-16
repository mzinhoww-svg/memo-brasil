// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: {}, ready: true, user: { id: "eu", name: "Emy" }, now: () => 10_000 }) }));
vi.mock("@/features/app/my-events", () => ({ loadMyEvents: mocks.load }));
vi.mock("@/revela/HostTabs", () => ({ HostTabs: () => null }));
vi.mock("@/components/revela/ScreenSkeleton", () => ({ ScreenSkeleton: () => null }));

const ev = (id: string, hostId: string, revealedAt?: number) => ({ id, hostId, title: id, revealedAt, revealEnabled: true, revealAt: revealedAt, startAt: 0, durationHours: 1 });

describe("useRevealedEvents", () => {
  it("inclui as festas reveladas em que a pessoa entrou como convidada (não só as que ela criou)", async () => {
    mocks.load.mockResolvedValue({ active: [], ended: [ev("meu", "eu", 5_000)], joined: [ev("eny-e-igor", "outro", 8_000), ev("ainda-nao", "outro")] });
    const { useRevealedEvents } = await import("./use-revealed");
    const { result } = renderHook(() => useRevealedEvents());
    await waitFor(() => expect(result.current.events).toBeDefined());
    expect(result.current.events!.map((e) => e.id)).toEqual(["eny-e-igor", "meu"]);
  });
});
