import { toPng } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { cn } from "~/lib/utils";

import type {
  ProofCardAspectRatio,
  ProofCardData,
  ProofCardScope,
  ProofCardType,
} from "../proof-card-types";

import {
  buildProofCardLines,
  proofCardSummaryText,
  type ProofCardLines,
  type ProofSupportLine,
} from "./proof-card-build";

function resolvePngBackground(el: HTMLElement): string {
  const bg = window.getComputedStyle(el).backgroundColor;
  if (
    bg &&
    bg !== "transparent" &&
    bg !== "rgba(0, 0, 0, 0)" &&
    !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(bg)
  ) {
    return bg;
  }
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--card")
    .trim();
  if (raw) return `hsl(${raw})`;
  return "#ffffff";
}

const SCOPE_OPTIONS: Array<{ value: ProofCardScope; label: string }> = [
  { value: "hybrid", label: "Hybrid" },
  { value: "all-time", label: "All time" },
  { value: "selected-range", label: "Selected range" },
];

const TYPE_OPTIONS: Array<{ value: ProofCardType; label: string }> = [
  { value: "milestone", label: "Milestone" },
  { value: "range_performance", label: "Range" },
  { value: "reliability", label: "Reliability" },
  { value: "adoption", label: "Adoption" },
  { value: "product_progress", label: "Product" },
];

const RATIO_OPTIONS: Array<{ value: ProofCardAspectRatio; label: string }> = [
  { value: "4:5", label: "4:5 portrait" },
  { value: "1:1", label: "1:1 square" },
  { value: "16:9", label: "16:9 landscape" },
];

/** High-res export size per ratio (content is scaled to fit). */
const EXPORT_PX: Record<ProofCardAspectRatio, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1280, h: 720 },
};

const PROOF_PREFS_KEY = "__sfs_admin_proof_export_prefs";

/** Shared hero scale for 1:1 and 16:9 layouts (sonar: single literal). */
const HERO_COMPACT_SCALE = "text-4xl sm:text-5xl";

function ratioHint(cardType: ProofCardType): string {
  switch (cardType) {
    case "product_progress":
      return "16:9 works well for embeds; 4:5 for social feeds.";
    case "reliability":
      return "4:5 or 1:1 keep the success % readable in-feed.";
    default:
      return "4:5 is tuned for mobile feeds.";
  }
}

function SupportLines({
  items,
  ratio,
  landscapePair = false,
}: {
  items: ProofSupportLine[];
  ratio: ProofCardAspectRatio;
  /** 16:9 right column: label above value */
  landscapePair?: boolean;
}) {
  const labelCls =
    ratio === "1:1"
      ? "text-muted-foreground text-[10px] leading-tight"
      : "text-muted-foreground text-xs leading-tight";
  const valueCls =
    ratio === "1:1"
      ? "text-sm font-semibold tabular-nums"
      : "text-sm font-semibold tabular-nums sm:text-base";

  if (landscapePair) {
    return (
      <ul className="flex flex-col gap-3">
        {items.map((s) => (
          <li key={`${s.label}-${s.value}`} className="min-w-0">
            <p className={labelCls}>{s.label}</p>
            <p
              className={cn(
                "mt-0.5 text-lg font-semibold tabular-nums",
                s.emphasis && "text-primary"
              )}
            >
              {s.value}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  const isGrid = ratio === "4:5";

  return (
    <ul
      className={cn(
        isGrid ? "grid grid-cols-2 gap-x-4 gap-y-3" : "flex flex-col gap-2.5"
      )}
    >
      {items.map((s) => (
        <li
          key={`${s.label}-${s.value}`}
          className={cn(
            "min-w-0",
            isGrid
              ? "flex flex-col gap-0.5"
              : "flex flex-row items-baseline justify-between gap-2"
          )}
        >
          <span className={labelCls}>{s.label}</span>
          <span
            className={cn(
              valueCls,
              s.emphasis && "text-primary",
              isGrid && "text-base"
            )}
          >
            {s.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FooterBlock({
  lines,
  ratio,
}: {
  lines: ProofCardLines["footerLines"];
  ratio: ProofCardAspectRatio;
}) {
  const textCls =
    ratio === "1:1"
      ? "text-muted-foreground text-[10px] leading-snug"
      : ratio === "16:9"
        ? "text-muted-foreground text-[10px] leading-snug sm:text-[11px]"
        : "text-muted-foreground text-[11px] leading-relaxed sm:text-xs";

  return (
    <div
      className={cn(
        "space-y-0.5",
        ratio === "16:9" && "border-border/40 mt-3 border-t pt-3"
      )}
    >
      {lines.map((line) => (
        <p key={line} className={textCls}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function AdminProofOfWorkSection({
  proofCard,
}: {
  proofCard: ProofCardData;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<ProofCardScope>("hybrid");
  const [cardType, setCardType] = useState<ProofCardType>("milestone");
  const [aspectRatio, setAspectRatio] = useState<ProofCardAspectRatio>("4:5");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROOF_PREFS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as Partial<{
        scope: ProofCardScope;
        cardType: ProofCardType;
        aspectRatio: ProofCardAspectRatio;
      }>;
      if (o.scope) setScope(o.scope);
      if (o.cardType) setCardType(o.cardType);
      if (o.aspectRatio) setAspectRatio(o.aspectRatio);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PROOF_PREFS_KEY,
        JSON.stringify({ scope, cardType, aspectRatio })
      );
    } catch {
      /* ignore */
    }
  }, [scope, cardType, aspectRatio]);

  const { formatDate, dateLocale } = useFormattedDate();

  const lines = useMemo(
    () =>
      buildProofCardLines({
        scope,
        type: cardType,
        data: proofCard,
        formatSnapshot: (iso) =>
          formatDate(iso, {
            dateFormatOptions: {
              dateStyle: "medium",
              timeStyle: "short",
            },
          }),
        numberLocale: dateLocale,
      }),
    [scope, cardType, proofCard, formatDate, dateLocale]
  );

  const summaryText = useMemo(() => proofCardSummaryText(lines), [lines]);

  const nostrCaption = useMemo(() => {
    const core = summaryText.replace(/\s+/g, " ").trim().slice(0, 220);
    return `${core}\n\n— SmartFlowSocial`;
  }, [summaryText]);

  const exportPng = useCallback(async () => {
    const el = cardRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const { w, h } = EXPORT_PX[aspectRatio];
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        width: w,
        height: h,
        backgroundColor: resolvePngBackground(el),
        style: {
          margin: "0",
          transform: "none",
          width: `${w}px`,
          height: `${h}px`,
          boxSizing: "border-box",
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `smartflow-proof-${aspectRatio.replace(":", "-")}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }, [aspectRatio]);

  const copyText = useCallback(async () => {
    await navigator.clipboard.writeText(summaryText);
  }, [summaryText]);

  const copyNostrCaption = useCallback(async () => {
    await navigator.clipboard.writeText(nostrCaption);
  }, [nostrCaption]);

  const reliabilitySampleLow =
    cardType === "reliability" &&
    proofCard.last30d.successfulShortPublishes +
      proofCard.last30d.failedShortPublishes <
      10;

  const heroReliability = cardType === "reliability";
  const heroClass = cn(
    "font-semibold leading-none tracking-tight tabular-nums",
    aspectRatio === "4:5" &&
      (heroReliability ? "text-5xl sm:text-6xl" : "text-5xl sm:text-[3.25rem]"),
    aspectRatio === "1:1" && HERO_COMPACT_SCALE,
    aspectRatio === "16:9" && HERO_COMPACT_SCALE
  );

  const subClass = cn(
    "text-muted-foreground leading-snug",
    aspectRatio === "4:5" && "mt-2 text-sm sm:text-base",
    aspectRatio === "1:1" && "mt-1.5 line-clamp-3 text-xs sm:text-sm",
    aspectRatio === "16:9" && "mt-2 max-w-[20rem] text-sm"
  );

  const cardShell = cn(
    "bg-card text-card-foreground box-border shrink-0 overflow-hidden rounded-2xl border border-l-4 border-l-primary bg-gradient-to-br from-primary/[0.06] to-transparent shadow-lg",
    aspectRatio === "4:5" &&
      "flex aspect-[4/5] w-full max-w-[min(100%,380px)] flex-col",
    aspectRatio === "1:1" &&
      "flex aspect-square w-full max-w-[min(100%,380px)] flex-col",
    aspectRatio === "16:9" &&
      "flex aspect-video w-full max-w-[min(100%,720px)] flex-col"
  );

  const innerPad = cn(
    "flex min-h-0 flex-1 flex-col",
    aspectRatio === "4:5" && "p-5 sm:p-6",
    aspectRatio === "1:1" && "p-4 sm:p-5",
    aspectRatio === "16:9" && "p-4 sm:p-5"
  );

  const eyebrowClass = cn(
    "font-medium tracking-widest uppercase text-muted-foreground",
    aspectRatio === "1:1" ? "text-[10px]" : "text-[11px] sm:text-xs"
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Public proof-of-work</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void copyText();
            }}
          >
            Copy text summary
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void copyNostrCaption();
            }}
          >
            Copy Nostr caption
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void exportPng();
            }}
            disabled={busy}
          >
            {busy ? "Exporting…" : `Export PNG (${aspectRatio})`}
          </Button>
        </div>
      </div>

      {reliabilitySampleLow ? (
        <p className="text-muted-foreground border-border rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-snug">
          Low sample for 30d reliability stats — interpret exports carefully or
          pick a longer window in the admin range before sharing.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium uppercase">
            Scope
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SCOPE_OPTIONS.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={scope === o.value ? "default" : "outline"}
                className="h-8"
                onClick={() => {
                  setScope(o.value);
                }}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium uppercase">
            Card type
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={cardType === o.value ? "default" : "outline"}
                className="h-8"
                onClick={() => {
                  setCardType(o.value);
                }}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              Ratio
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RATIO_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={aspectRatio === o.value ? "default" : "outline"}
                  className="h-8"
                  onClick={() => {
                    setAspectRatio(o.value);
                  }}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground max-w-xl text-xs">
            {ratioHint(cardType)}
          </p>
        </div>
      </div>

      <div className="flex w-full justify-center">
        <div ref={cardRef} className={cardShell}>
          <div className={innerPad}>
            {aspectRatio === "16:9" ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div className="flex flex-col justify-center">
                  <p className={eyebrowClass}>{lines.eyebrow}</p>
                  <p className={cn(heroClass, "mt-2")}>{lines.headline}</p>
                  <p className={subClass}>{lines.headlineSub}</p>
                </div>
                <div className="border-border/50 flex flex-col justify-center sm:border-l sm:pl-6">
                  <SupportLines
                    items={lines.support}
                    ratio={aspectRatio}
                    landscapePair
                  />
                  <FooterBlock lines={lines.footerLines} ratio={aspectRatio} />
                </div>
              </div>
            ) : aspectRatio === "1:1" ? (
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
                <div>
                  <p className={eyebrowClass}>{lines.eyebrow}</p>
                  <p className={cn(heroClass, "mt-2")}>{lines.headline}</p>
                  <p className={subClass}>{lines.headlineSub}</p>
                </div>
                <SupportLines items={lines.support} ratio={aspectRatio} />
                <FooterBlock lines={lines.footerLines} ratio={aspectRatio} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
                <div>
                  <p className={eyebrowClass}>{lines.eyebrow}</p>
                  <p className={cn(heroClass, "mt-3")}>{lines.headline}</p>
                  <p className={subClass}>{lines.headlineSub}</p>
                </div>
                <div className="min-h-0 flex-1">
                  <SupportLines items={lines.support} ratio={aspectRatio} />
                </div>
                <div className="border-border/50 mt-auto border-t pt-3">
                  <FooterBlock lines={lines.footerLines} ratio={aspectRatio} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
