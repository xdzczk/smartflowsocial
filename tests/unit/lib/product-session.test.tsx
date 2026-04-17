/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProductSessionTelemetry } from "~/lib/telemetry/product-session";

describe("useProductSessionTelemetry", () => {
  type FetchInitWithBody = RequestInit & { body?: string };
  const mockFetchCalls = () =>
    (fetch as ReturnType<typeof vi.fn>).mock.calls as Array<
      [RequestInfo | URL, FetchInitWithBody | undefined]
    >;
  const parseBody = (
    body: string | undefined
  ): { phase?: string; clientSessionId?: string } =>
    body
      ? (JSON.parse(body) as { phase?: string; clientSessionId?: string })
      : {};

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }))
    );
  });

  it("does nothing when disabled", () => {
    renderHook(() => useProductSessionTelemetry(false));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts start/heartbeat/end lifecycle beacons", () => {
    const { unmount } = renderHook(() => useProductSessionTelemetry(true));
    expect(fetch).toHaveBeenCalled();
    const startBody = parseBody(mockFetchCalls()[0]?.[1]?.body);
    expect(startBody.phase).toBe("start");
    expect(typeof startBody.clientSessionId).toBe("string");

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    const heartbeatCall = mockFetchCalls().find(([, init]) =>
      String(init?.body).includes('"phase":"heartbeat"')
    );
    expect(heartbeatCall).toBeTruthy();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
    });

    unmount();
    const hasEnd = mockFetchCalls().some(([, init]) =>
      String(init?.body).includes('"phase":"end"')
    );
    expect(hasEnd).toBe(true);
  });
});
