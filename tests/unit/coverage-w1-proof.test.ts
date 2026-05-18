import { toPng } from "html-to-image";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { brandLineProofCaption } from "~/lib/brand";
import { buildContestProofPayload } from "~/lib/proof/adapters/contest";
import { buildGiveawayProofPayload } from "~/lib/proof/adapters/giveaway";
import { buildProofCaption } from "~/lib/proof/build-proof-caption";
import { buildProofSummary } from "~/lib/proof/build-proof-summary";
import {
  exportProofCardPng,
  measureProofCardRoot,
  PROOF_EXPORT_SNAPSHOT_CLASS,
  proofExportFilename,
  resolveProofExportScale,
  resolveProofPngBackground,
} from "~/lib/proof/export-proof-card";
import {
  PROOF_EXPORT_PX,
  proofPreviewExportFallbackPx,
} from "~/lib/proof/ratios";
import {
  proofCardAspectOuterClass,
  proofCardInnerPadClass,
  proofCardShellSurfaceClass,
  proofEyebrowClass,
  proofFooterTextClass,
  proofHeroClass,
  proofSubClass,
  statusBadgeClass,
} from "~/lib/proof/themes";
import type { ProofCardPayload } from "~/lib/proof/types";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,fake"),
}));

describe("W1 proof coverage", () => {
  const fakeElement = (): HTMLElement =>
    ({
      querySelector: () => null,
    }) as unknown as HTMLElement;
  const basePayload: ProofCardPayload = {
    domain: "giveaway",
    cardType: "public-summary",
    ratio: "square",
    title: "My Title",
    subtitle: "My Subtitle",
    heroValue: "10",
    heroLabel: "items",
    footer: {
      productLabel: "SmartFlowSocial",
      snapshotLabel: "Snapshot",
      timeRangeLabel: "7d",
      referenceLabel: "Ref",
    },
  };

  describe("buildProofSummary", () => {
    it("builds metric-first summaries and trims empty lines", () => {
      const summary = buildProofSummary({
        ...basePayload,
        metricFirst: true,
        eyebrow: "Eyebrow",
        stats: [{ label: "A", value: "1" }],
        statusBadge: { label: "Done", tone: "success" },
      });

      expect(summary).toContain("Eyebrow");
      expect(summary).toContain("10 - items");
      expect(summary).toContain("Status: Done");
      expect(summary).toContain("A: 1");
      expect(summary).toContain("SmartFlowSocial");
    });

    it("falls back to title/subtitle when hero is absent", () => {
      const summary = buildProofSummary({
        domain: "admin",
        cardType: "range",
        ratio: "portrait",
        title: "Title Only",
        subtitle: "Subtitle",
      });
      expect(summary).toBe("Title Only\nSubtitle");
    });
  });

  describe("buildProofCaption", () => {
    it("creates giveaway public-summary caption", () => {
      const caption = buildProofCaption({
        ...basePayload,
        domain: "giveaway",
        cardType: "public-summary",
        winnersCount: 2,
        satsPlanned: 5000,
      });
      expect(caption).toContain("Completed giveaway");
      expect(caption).toContain("2 winners");
      expect(caption).toContain("5,000 sats distributed");
      expect(caption).toContain(brandLineProofCaption);
    });

    it("creates contest public-summary caption", () => {
      const caption = buildProofCaption({
        ...basePayload,
        domain: "contest",
        cardType: "public-summary",
        winnersCount: 1,
        satsPlanned: 42,
      });
      expect(caption).toContain("Contest complete");
      expect(caption).toContain("1 winner");
      expect(caption).toContain("42 sats");
    });

    it("creates admin caption with newline brand line", () => {
      const caption = buildProofCaption({
        ...basePayload,
        domain: "admin",
        cardType: "milestone",
      });
      expect(caption).toContain("\n\n");
      expect(caption.endsWith(brandLineProofCaption)).toBe(true);
    });

    it("uses generic fallback caption path", () => {
      const caption = buildProofCaption({
        ...basePayload,
        domain: "contest",
        cardType: "receipt",
      });
      expect(caption).toContain(brandLineProofCaption);
    });
  });

  describe("contest/giveaway adapters", () => {
    const contestDto = {
      id: "contest-123456789",
      title: "Contest X",
      rankingMetric: "REACTIONS",
      statusLabel: "Completed",
      winnerCount: 3,
      satsPlanned: 1000,
      satsPaid: 800,
      paidViaWalletCount: 1,
      paidManuallyCount: 2,
      unresolvedCount: 0,
      finalizationFeeSats: 10,
      planAtFinalization: "pro",
      payoutWalletMode: "nwc_creator" as const,
      payoutAutoRunEnabled: true,
      completedAtLabel: "2026-01-01",
      tieBreakRule: "earliest",
      entryType: "REPLY_DIRECT",
      eligibleEntries: 10,
      durationLabel: "7d",
    };

    const giveawayDto = {
      id: "giveaway-123456789",
      title: "Giveaway X",
      scopeSummaryLabel: "last 7 days",
      statusLabel: "Paid out",
      winnerCount: 2,
      satsPlanned: 200,
      satsPaid: 180,
      paidViaWalletCount: 1,
      paidManuallyCount: 1,
      unresolvedCount: 1,
      finalizationFeeSats: 3,
      planAtFinalization: "pro",
      payoutWalletMode: "manual" as const,
      payoutAutoRunEnabled: false,
      completedAtLabel: "2026-01-01",
      selectionMode: "WEIGHTED_BY_ENGAGEMENT",
      eligiblePoolSize: 30,
    };

    it("builds all contest payload card types", () => {
      const summary = buildContestProofPayload(
        contestDto,
        "public-summary",
        "portrait",
        { showLogo: false, showReferenceId: true, showTimestamp: false }
      );
      expect(summary.domain).toBe("contest");
      expect(summary.stats?.length).toBeLessThanOrEqual(4);
      expect(summary.footer?.referenceLabel).toContain("Ref");

      const fairness = buildContestProofPayload(
        { ...contestDto, unresolvedCount: 2, payoutAutoRunEnabled: false },
        "fairness-proof",
        "square"
      );
      expect(fairness.statusBadge?.tone).toBe("warning");
      expect(fairness.selectionSummary).toContain("Tie-break");

      const receipt = buildContestProofPayload(
        { ...contestDto, finalizationFeeSats: null },
        "receipt",
        "landscape"
      );
      expect(receipt.statusBadge?.label).toContain("Settlement");
      expect(receipt.finalizationFeeSats).toBeUndefined();
    });

    it("builds all giveaway payload card types", () => {
      const summary = buildGiveawayProofPayload(
        giveawayDto,
        "public-summary",
        "portrait"
      );
      expect(summary.domain).toBe("giveaway");
      expect(summary.stats?.length).toBeLessThanOrEqual(4);

      const fairness = buildGiveawayProofPayload(
        giveawayDto,
        "fairness-proof",
        "square",
        { showReferenceId: true, showTimestamp: false }
      );
      expect(fairness.selectionSummary).toContain("Weighted");
      expect(fairness.footer?.referenceLabel).toContain("Ref");

      const receipt = buildGiveawayProofPayload(
        { ...giveawayDto, unresolvedCount: 0, finalizationFeeSats: 0 },
        "receipt",
        "landscape"
      );
      expect(receipt.statusBadge?.tone).toBe("success");
      expect(receipt.finalizationFeeSats).toBeUndefined();
    });
  });

  describe("themes", () => {
    it("covers class builders for all ratio/tone branches", () => {
      expect(proofCardAspectOuterClass("portrait")).toContain("aspect-[4/5]");
      expect(proofCardAspectOuterClass("square")).toContain("aspect-square");
      expect(proofCardAspectOuterClass("landscape")).toContain("aspect-video");

      expect(proofCardShellSurfaceClass("campaign")).toContain("from-brand");
      expect(proofCardShellSurfaceClass("admin")).not.toContain("from-brand");

      expect(proofCardInnerPadClass("portrait")).toContain("p-5");
      expect(proofCardInnerPadClass("square")).toContain("p-4");

      expect(proofEyebrowClass("square")).toContain("text-[10px]");
      expect(proofHeroClass("portrait", true)).toContain("text-6xl");
      expect(proofHeroClass("portrait", false)).toContain("text-[3.25rem]");
      expect(proofHeroClass("square")).toContain("text-4xl");

      expect(proofSubClass("portrait")).toContain("text-sm");
      expect(proofSubClass("square")).toContain("line-clamp-3");
      expect(proofSubClass("landscape")).toContain("line-clamp-2");
      expect(proofCardInnerPadClass("landscape")).toContain("px-6");

      expect(proofFooterTextClass("square")).toContain("text-[10px]");
      expect(proofFooterTextClass("landscape")).toContain("sm:text-[11px]");
      expect(proofFooterTextClass("portrait")).toContain("sm:text-xs");

      expect(statusBadgeClass("success")).toContain("success-text");
      expect(statusBadgeClass("warning")).toContain("warning-text");
      expect(statusBadgeClass("neutral")).toContain("surface-hover");
    });
  });

  describe("export-proof-card", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("uses element background when non-transparent", () => {
      vi.stubGlobal("window", {
        getComputedStyle: vi.fn(() => ({ backgroundColor: "rgb(1, 2, 3)" })),
      });
      expect(resolveProofPngBackground(fakeElement())).toBe("rgb(1, 2, 3)");
    });

    it("falls back to --surface CSS variable when transparent", () => {
      const getComputedStyle = vi
        .fn()
        .mockReturnValueOnce({ backgroundColor: "rgba(0, 0, 0, 0)" })
        .mockReturnValueOnce({
          getPropertyValue: (name: string) =>
            name === "--surface" ? "0 0% 100%" : "",
        });
      vi.stubGlobal("window", { getComputedStyle });
      vi.stubGlobal("document", { documentElement: {} });
      expect(resolveProofPngBackground(fakeElement())).toBe("hsl(0 0% 100%)");
    });

    it("reads background from data-proof-card-surface descendant", () => {
      const surface = Object.create(null) as HTMLElement;
      const root = {
        querySelector: vi.fn(() => surface),
      } as unknown as HTMLElement;
      const getComputedStyle = vi.fn(() => ({
        backgroundColor: "rgb(250, 250, 250)",
      }));
      vi.stubGlobal("window", { getComputedStyle });
      expect(resolveProofPngBackground(root)).toBe("rgb(250, 250, 250)");
      expect(root.querySelector).toHaveBeenCalledWith(
        "[data-proof-card-surface]"
      );
    });

    it("falls back to white when no surface bg and no token values", () => {
      const emptyTokens = { getPropertyValue: () => "" };
      const getComputedStyle = vi
        .fn()
        .mockReturnValueOnce({ backgroundColor: "transparent" })
        .mockReturnValueOnce(emptyTokens)
        .mockReturnValueOnce(emptyTokens);
      vi.stubGlobal("window", { getComputedStyle });
      vi.stubGlobal("document", { documentElement: {} });
      expect(resolveProofPngBackground(fakeElement())).toBe("#ffffff");
    });

    it("measures card root from bounding rect", () => {
      const cardRoot = {
        getBoundingClientRect: () => ({ width: 372.4, height: 465.1 }),
      } as unknown as HTMLElement;
      expect(measureProofCardRoot(cardRoot, "portrait")).toEqual({
        w: 372,
        h: 465,
      });
    });

    it("falls back to preview max size when card rect is zero", () => {
      const cardRoot = {
        getBoundingClientRect: () => ({ width: 0, height: 0 }),
      } as unknown as HTMLElement;
      expect(measureProofCardRoot(cardRoot, "portrait")).toEqual(
        proofPreviewExportFallbackPx("portrait")
      );
      expect(proofPreviewExportFallbackPx("landscape")).toEqual({
        w: 720,
        h: 405,
      });
    });

    it("formats proof export filenames", () => {
      expect(
        proofExportFilename({
          domain: "contest",
          cardType: "public_summary",
          date: new Date("2026-05-20T00:00:00.000Z"),
        })
      ).toBe("contest-public-summary-2026-05-20.png");
    });

    it("resolves export scale without changing card proportions", () => {
      expect(
        resolveProofExportScale({
          source: { w: 360, h: 360 },
          target: PROOF_EXPORT_PX.square,
        })
      ).toBe(3);
    });

    it("exports png using html-to-image and clicks download anchor", async () => {
      const click = vi.fn();
      const anchor = { href: "", download: "", click };
      const classList = { add: vi.fn(), remove: vi.fn() };
      const cardRootClassList = { add: vi.fn(), remove: vi.fn() };
      const tokenStyle = new Map<string, string>();
      const cardRoot = {
        classList: cardRootClassList,
        getBoundingClientRect: () => ({ width: 360, height: 360 }),
        style: {
          getPropertyValue: vi.fn((name: string) => tokenStyle.get(name) ?? ""),
          setProperty: vi.fn((name: string, value: string) => {
            tokenStyle.set(name, value);
          }),
          removeProperty: vi.fn((name: string) => {
            tokenStyle.delete(name);
          }),
        },
      } as unknown as HTMLElement;
      const element = {
        classList,
        querySelector: vi.fn((selector: string) =>
          selector === "[data-proof-card-root]" ? cardRoot : null
        ),
      } as unknown as HTMLElement;
      const getComputedStyle = vi
        .fn()
        .mockImplementation((node: HTMLElement) => {
          if (node === cardRoot) {
            return {
              getPropertyValue: (name: string) =>
                name === "--text"
                  ? "220 10% 96%"
                  : name === "--surface"
                    ? "220 7% 14.2%"
                    : "",
            };
          }
          return { backgroundColor: "rgb(20, 20, 20)" };
        });
      vi.stubGlobal("window", { getComputedStyle });
      vi.stubGlobal("document", {
        createElement: vi.fn((tag: string) => {
          if (tag === "a") return anchor;
          throw new Error(`unexpected tag ${tag}`);
        }),
        documentElement: {},
      });
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });

      await exportProofCardPng({
        element,
        ratio: "square",
        filename: "x.png",
      });

      expect(classList.add).toHaveBeenCalledWith(PROOF_EXPORT_SNAPSHOT_CLASS);
      expect(cardRootClassList.add).toHaveBeenCalledWith(
        PROOF_EXPORT_SNAPSHOT_CLASS
      );
      expect(classList.remove).toHaveBeenCalledWith(
        PROOF_EXPORT_SNAPSHOT_CLASS
      );
      expect(cardRootClassList.remove).toHaveBeenCalledWith(
        PROOF_EXPORT_SNAPSHOT_CLASS
      );
      expect(cardRoot.style.setProperty).toHaveBeenCalledWith(
        "--text",
        "220 10% 96%"
      );
      expect(cardRoot.style.setProperty).toHaveBeenCalledWith(
        "--surface",
        "220 7% 14.2%"
      );
      expect(cardRoot.style.removeProperty).toHaveBeenCalledWith("--text");
      expect(toPng).toHaveBeenCalledOnce();
      const [capturedRoot, toPngOptions] = vi.mocked(toPng).mock.calls[0] ?? [];
      expect(capturedRoot).toBe(cardRoot);
      expect(toPngOptions).toMatchObject({
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        style: {
          width: "360px",
          height: "360px",
          maxWidth: "none",
          transform: "scale(3)",
          transformOrigin: "top left",
        },
      });
      expect(click).toHaveBeenCalledTimes(1);
      expect(anchor.download).toBe("x.png");
      expect(anchor.href).toContain("data:image/png;base64");
    });
  });
});
