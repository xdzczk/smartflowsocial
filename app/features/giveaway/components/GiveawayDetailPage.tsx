import { useFetcher, Link } from "@remix-run/react";
import { useState, useEffect } from "react";

import ZapButton from "~/components/dashboard/ZapButton";

import type { GiveawayWinnerEntry } from "../types";

const BATCH_ZAP_STORAGE_KEY = "giveaway_batch_zap";

function getMarkedZapped(giveawayId: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(
      `${BATCH_ZAP_STORAGE_KEY}:${giveawayId}`
    );
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function setMarkedZapped(giveawayId: string, npub: string, value: boolean) {
  if (typeof window === "undefined") return;
  const prev = getMarkedZapped(giveawayId);
  sessionStorage.setItem(
    `${BATCH_ZAP_STORAGE_KEY}:${giveawayId}`,
    JSON.stringify({ ...prev, [npub]: value })
  );
}

type GiveawayStatus =
  | "DRAFT"
  | "PREVIEWED"
  | "LOCKED"
  | "PAID_OUT"
  | "CANCELLED";

interface GiveawayDetailPageProps {
  giveaway: {
    id: string;
    status: GiveawayStatus;
    scopeType: string;
    winnerCount: number;
    winnerSnapshot: GiveawayWinnerEntry[] | null;
    lockedAt: string | null;
    createdAt: string;
  };
  canUsePresets?: boolean;
}

export function GiveawayDetailPage({
  giveaway,
  canUsePresets = false,
}: GiveawayDetailPageProps) {
  const previewFetcher = useFetcher<{
    winners?: GiveawayWinnerEntry[];
    error?: string;
  }>();
  const lockFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const cancelFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const paidFetcher = useFetcher<{ success?: boolean; error?: string }>();

  const winners =
    (previewFetcher.data?.winners?.length
      ? previewFetcher.data.winners
      : giveaway.winnerSnapshot) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/giveaway"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Giveaways
        </Link>
      </div>

      <div className="border-border bg-card rounded-lg border p-4">
        <h1 className="text-foreground mb-2 text-xl font-bold">
          Giveaway {giveaway.id.slice(0, 8)}
        </h1>
        <p className="text-muted-foreground text-sm">
          Scope: {giveaway.scopeType} · Winners: {giveaway.winnerCount} ·
          Status: {giveaway.status}
        </p>
      </div>

      {giveaway.status === "CANCELLED" ? (
        <p className="text-muted-foreground">This giveaway was cancelled.</p>
      ) : null}

      {giveaway.status === "DRAFT" || giveaway.status === "PREVIEWED" ? (
        <div className="space-y-4">
          {canUsePresets ? <SavePresetForm /> : null}
          {giveaway.status === "DRAFT" ? (
            <previewFetcher.Form method="post">
              <input type="hidden" name="intent" value="preview" />
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-md px-4 py-2"
                disabled={previewFetcher.state !== "idle"}
              >
                {previewFetcher.state !== "idle"
                  ? "Loading…"
                  : "Preview winners"}
              </button>
            </previewFetcher.Form>
          ) : null}

          {previewFetcher.data?.error || lockFetcher.data?.error ? (
            <p className="text-destructive text-sm">
              {previewFetcher.data?.error ?? lockFetcher.data?.error}
            </p>
          ) : null}

          {giveaway.status === "PREVIEWED" ? (
            <>
              <previewFetcher.Form method="post">
                <input type="hidden" name="intent" value="reroll" />
                <button
                  type="submit"
                  className="border-border mr-2 rounded-md border px-4 py-2"
                  disabled={previewFetcher.state !== "idle"}
                >
                  Reroll
                </button>
              </previewFetcher.Form>
              <lockFetcher.Form method="post">
                <input type="hidden" name="intent" value="lock" />
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground mr-2 rounded-md px-4 py-2"
                  disabled={lockFetcher.state !== "idle"}
                >
                  Lock winners
                </button>
              </lockFetcher.Form>
              <cancelFetcher.Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <button
                  type="submit"
                  className="text-destructive border-border rounded-md border px-4 py-2"
                  disabled={cancelFetcher.state !== "idle"}
                >
                  Cancel giveaway
                </button>
              </cancelFetcher.Form>
            </>
          ) : null}

          {winners.length > 0 ? (
            <div className="border-border rounded-lg border p-4">
              <h2 className="text-foreground mb-3 font-semibold">
                Selected winners ({winners.length})
              </h2>
              <ul className="space-y-2">
                {winners.map((w, i) => (
                  <li
                    key={w.pubkey}
                    className="border-border bg-muted/30 flex items-center justify-between rounded border p-2"
                  >
                    <span className="text-foreground text-sm">
                      {i + 1}. {w.npub.slice(0, 16)}…
                    </span>
                    {giveaway.status === "PREVIEWED" ? (
                      <ExcludeWinnerForm
                        giveawayId={giveaway.id}
                        winnerPubkey={w.pubkey}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {giveaway.status === "LOCKED" ? (
        <BatchZapFlow
          giveawayId={giveaway.id}
          winners={winners}
          lockedAt={giveaway.lockedAt}
          paidFetcher={paidFetcher}
        />
      ) : null}

      {giveaway.status === "PAID_OUT" ? (
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Giveaway completed.</p>
          <ul className="text-foreground mt-2 list-inside list-disc text-sm">
            {winners.map((w) => (
              <li key={w.pubkey}>{w.npub}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SavePresetForm() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value="savePreset" />
      <label htmlFor="presetName" className="text-muted-foreground text-sm">
        Save as preset:
      </label>
      <input
        id="presetName"
        name="presetName"
        type="text"
        placeholder="Preset name"
        className="border-border bg-background rounded border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="border-border rounded-md border px-3 py-1 text-sm"
        disabled={fetcher.state !== "idle"}
      >
        Save
      </button>
    </fetcher.Form>
  );
}

function BatchZapFlow({
  giveawayId,
  winners,
  lockedAt,
  paidFetcher,
}: {
  giveawayId: string;
  winners: GiveawayWinnerEntry[];
  lockedAt: string | null;
  paidFetcher: ReturnType<typeof useFetcher>;
}) {
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMarked(getMarkedZapped(giveawayId));
  }, [giveawayId]);

  const currentWinner = winners[step];
  const markedCount = Object.values(marked).filter(Boolean).length;
  const allDone = winners.length === 0 || step >= winners.length;

  const handleMarkZapped = () => {
    if (!currentWinner) return;
    setMarkedZapped(giveawayId, currentWinner.npub, true);
    setMarked((prev) => ({ ...prev, [currentWinner.npub]: true }));
    setStep((s) => Math.min(s + 1, winners.length));
  };

  const handleSkip = () => {
    setStep((s) => Math.min(s + 1, winners.length));
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Locked at {lockedAt ? new Date(lockedAt).toLocaleString() : ""}. Zap
        each winner (or skip), then mark as paid out.
      </p>
      <p className="text-muted-foreground text-xs">
        Winner {step + 1} of {winners.length} · Marked: {markedCount}
      </p>
      {!allDone && currentWinner ? (
        <div className="border-border bg-muted/30 rounded-lg border p-4">
          <p className="text-foreground font-mono text-sm">
            {currentWinner.npub}
          </p>
          <ZapButton npub={currentWinner.npub} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleMarkZapped}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
            >
              Mark as zapped
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="border-border rounded-md border px-4 py-2 text-sm"
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}
      {allDone ? (
        <paidFetcher.Form method="post">
          <input type="hidden" name="intent" value="markPaidOut" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2"
            disabled={paidFetcher.state !== "idle"}
          >
            Mark as paid out
          </button>
        </paidFetcher.Form>
      ) : null}
    </div>
  );
}

function ExcludeWinnerForm({
  giveawayId: _giveawayId,
  winnerPubkey,
}: {
  giveawayId: string;
  winnerPubkey: string;
}) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="exclude" />
      <input type="hidden" name="winnerPubkey" value={winnerPubkey} />
      <button
        type="submit"
        className="text-muted-foreground hover:text-destructive text-xs"
        disabled={fetcher.state !== "idle"}
      >
        Exclude
      </button>
    </fetcher.Form>
  );
}
