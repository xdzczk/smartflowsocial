import { describe, expect, it } from "vitest";

import {
  onTimeRate,
  profileBits,
  safeImageUrl,
  selectPeople,
} from "~/features/public-stats/stats-payload";

describe("profileBits", () => {
  it("reads a kind 0 object and a stringified profile", () => {
    expect(
      profileBits({ display_name: "Ada", picture: "https://cdn.example/a.png" })
    ).toEqual({ name: "Ada", picture: "https://cdn.example/a.png" });

    expect(
      profileBits(
        JSON.stringify({
          profile: { name: "nested", picture: "http://x/p.jpg" },
        })
      )
    ).toEqual({ name: "nested", picture: "http://x/p.jpg" });
  });

  it("drops pictures that are not http(s)", () => {
    expect(
      profileBits({ name: "x", picture: "data:image/png;base64,aa" })
    ).toEqual({ name: "x", picture: null });
  });
});

describe("selectPeople", () => {
  it("keeps the most recent publish per account and skips missing pictures", () => {
    const older = new Date("2026-10-01T00:00:00Z");
    const newer = new Date("2026-11-01T00:00:00Z");
    const people = selectPeople([
      {
        userId: "a",
        publishedAt: older,
        npub: "npub1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        profile: { name: "Old" },
      },
      {
        userId: "b",
        publishedAt: older,
        npub: "npub1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        profile: { display_name: "Bea", picture: "https://img.example/b.png" },
      },
      {
        userId: "b",
        publishedAt: newer,
        npub: "npub1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        profile: { display_name: "Bea", picture: "https://img.example/b.png" },
      },
    ]);
    expect(people).toEqual([
      {
        npub: "npub1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        name: "Bea",
      },
    ]);
  });
});

describe("onTimeRate", () => {
  it("is null with no rows and a ratio otherwise", () => {
    expect(onTimeRate([])).toBeNull();
    const at = new Date("2026-11-01T00:00:00Z");
    const late = new Date("2026-11-01T00:30:00Z");
    expect(
      onTimeRate([
        { publishedAt: at, scheduledAtUtc: at },
        { publishedAt: late, scheduledAtUtc: at },
      ])
    ).toBe(0.5);
  });
});

describe("safeImageUrl", () => {
  it("allows public https and rejects local targets", () => {
    expect(safeImageUrl("https://cdn.example/a.png")?.hostname).toBe(
      "cdn.example"
    );
    expect(safeImageUrl("http://127.0.0.1/a.png")).toBeNull();
    expect(safeImageUrl("https://192.168.1.5/a.png")).toBeNull();
    expect(safeImageUrl("https://169.254.169.254/latest")).toBeNull();
    expect(safeImageUrl("file:///etc/passwd")).toBeNull();
    expect(safeImageUrl("http://user:pass@cdn.example/a.png")).toBeNull();
  });
});
