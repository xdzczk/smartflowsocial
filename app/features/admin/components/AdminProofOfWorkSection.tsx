import { toPng } from "html-to-image";
import { useCallback, useRef, useState } from "react";

import { Button } from "~/components/ui/button";

export interface ProofOfWorkStats {
  totalPostsPublished: number;
  totalPostsScheduled: number;
  totalLongFormPublished: number;
  totalPublishers: number;
  totalReferralSatsPaid: number;
  publishSuccessRate30d: number;
}

export function AdminProofOfWorkSection({
  stats,
}: {
  stats: ProofOfWorkStats;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const summaryText = [
    `SmartFlow Social — proof of work`,
    `${stats.totalPostsPublished.toLocaleString()} posts published through the platform`,
    `${stats.totalLongFormPublished.toLocaleString()} long-form notes published`,
    `${stats.totalPostsScheduled.toLocaleString()} posts currently scheduled`,
    `${stats.totalPublishers.toLocaleString()} creators have published`,
    `${stats.publishSuccessRate30d}% publish success rate (30d)`,
    `${stats.totalReferralSatsPaid.toLocaleString()} sats paid via referrals`,
  ].join("\n");

  const exportPng = useCallback(async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `smartflow-proof-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }, []);

  const copyText = useCallback(async () => {
    await navigator.clipboard.writeText(summaryText);
  }, [summaryText]);

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
            size="sm"
            onClick={() => {
              void exportPng();
            }}
            disabled={busy}
          >
            {busy ? "Exporting…" : "Export PNG"}
          </Button>
        </div>
      </div>
      <div
        ref={cardRef}
        className="bg-card text-card-foreground mx-auto max-w-lg rounded-2xl border p-8 shadow-lg"
      >
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          SmartFlow Social
        </p>
        <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
          {stats.totalPostsPublished.toLocaleString()}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          posts published through the platform
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Long-form</p>
            <p className="text-xl font-semibold tabular-nums">
              {stats.totalLongFormPublished.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Creators</p>
            <p className="text-xl font-semibold tabular-nums">
              {stats.totalPublishers.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Success (30d)</p>
            <p className="text-xl font-semibold tabular-nums">
              {stats.publishSuccessRate30d}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Referral sats paid</p>
            <p className="text-xl font-semibold tabular-nums">
              {stats.totalReferralSatsPaid.toLocaleString()}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground mt-8 text-xs">
          Milestone card — share on Nostr with integrity.
        </p>
      </div>
    </section>
  );
}
