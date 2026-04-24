import { Link } from "@remix-run/react";
import { useRef, useState } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import {
  getQueueAccentHex,
  getQueueColorBundle,
  type QueueColorBundle,
} from "../queue-colors";
import type { QueueType } from "../types";

/** Solid Tailwind background class per named queue for bar fill (no arbitrary values). */
const BAR_FILL_CLASS: Record<string, string> = {
  main: "bg-brand",
  memes: "bg-success",
  quotes: "bg-brand-soft",
  unassigned: "bg-surface-hover",
};

function getBarFillClass(queueName: string): string {
  return BAR_FILL_CLASS[queueName.toLowerCase()] ?? "bg-surface-hover";
}

export interface QueueHealthProps {
  queueCounts: Array<{ queueName: string; count: number }>;
  queueTypes?: Array<
    | QueueType
    | { name: string; color?: string | null; colorToken?: string | null }
  >;
  /** Opens create-queue UI (e.g. modal) without leaving the dashboard. Falls back to settings link when omitted. */
  onCreateQueueClick?: () => void;
}

function getQueueToken(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): string | null {
  if (!queueTypes) return null;
  const qt = queueTypes.find(
    (q) => (typeof q === "object" ? q.name : q) === queueName
  );
  if (typeof qt !== "object") return null;
  const withToken = qt as { colorToken?: string | null };
  return withToken.colorToken ?? null;
}

function getQueueBundle(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): QueueColorBundle | null {
  const token = getQueueToken(queueName, queueTypes);
  if (!token) return null;
  return getQueueColorBundle(token);
}

/** Accent hex for bar fill when using token; null when using Tailwind fallback. */
function getQueueAccentHexOrNull(
  queueName: string,
  queueTypes: QueueHealthProps["queueTypes"]
): string | null {
  const token = getQueueToken(queueName, queueTypes);
  if (!token) return null;
  return getQueueAccentHex(token);
}

export default function QueueHealth({
  queueCounts,
  queueTypes,
  onCreateQueueClick,
}: QueueHealthProps) {
  const [colorsRevealed, setColorsRevealed] = useState(false);
  const wasRevealedAtPointerDownRef = useRef(false);
  const countsByQueue = queueCounts.filter((c) => c.queueName !== "Unassigned");
  const maxCount =
    countsByQueue.length > 0
      ? Math.max(...countsByQueue.map((c) => c.count), 1)
      : 1;

  return (
    <div
      className={`focus-ring group flex w-full min-w-0 flex-col focus-visible:ring-inset lg:min-h-0 lg:flex-1 ${colorsRevealed ? "colors-revealed" : ""}`}
      tabIndex={0}
      role="button"
      aria-label="Queue Health"
      aria-pressed={colorsRevealed}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, a, [role='button']"))
          return;
        wasRevealedAtPointerDownRef.current = colorsRevealed;
        if (e.pointerType !== "mouse") {
          setColorsRevealed(true);
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, [role='button']"))
          return;
        if (e.detail === 0) return;
        if (wasRevealedAtPointerDownRef.current) {
          setColorsRevealed(false);
        } else {
          setColorsRevealed(true);
        }
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setColorsRevealed((v) => !v);
        }
      }}
    >
      <Card className="flex min-w-0 flex-1 flex-col lg:h-full lg:min-h-0">
        <CardHeader className="px-3.5 pt-1.5 pb-1 sm:px-4 sm:pt-2">
          <h3 className="text-overline text-text-secondary">Queue Health</h3>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3.5 pt-0 pb-3 sm:px-4">
          {countsByQueue.length === 0 ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start gap-3 py-2 text-left lg:min-h-0 lg:pt-3 lg:pb-1">
              <div className="min-w-0 space-y-2">
                <p className="text-text text-sm font-medium">
                  No queue health yet.
                </p>
                <p className="text-text-secondary text-xs leading-relaxed">
                  Queues are reusable publishing lanes.
                </p>
                <ol className="text-text-secondary mt-0.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed marker:tabular-nums">
                  <li className="pl-0.5">Create a queue</li>
                  <li className="pl-0.5">Add posts from Compose or Bulk</li>
                  <li className="pl-0.5">
                    Keep queues filled for consistent posting
                  </li>
                </ol>
              </div>
              {onCreateQueueClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateQueueClick();
                  }}
                  className="focus-ring text-text-secondary hover:text-text w-fit rounded-xs text-left text-xs font-medium underline underline-offset-2"
                >
                  Create queue
                </button>
              ) : (
                <Link
                  to="/dashboard/settings?tab=publishing"
                  className="focus-ring text-text-secondary hover:text-text w-fit rounded-xs text-xs font-medium underline underline-offset-2"
                >
                  Create queue
                </Link>
              )}
            </div>
          ) : (
            <ul
              className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3 sm:gap-2 sm:p-3.5"
              aria-label="Scheduled posts per queue"
            >
              {countsByQueue.map(({ queueName, count }) => {
                const bundle = getQueueBundle(queueName, queueTypes);
                const accentHex = getQueueAccentHexOrNull(
                  queueName,
                  queueTypes
                );
                const widthPercent = (count / maxCount) * 100;
                const scheduledUrl = `/dashboard/scheduled?queueType=${encodeURIComponent(queueName)}`;

                return (
                  <li key={queueName} className="flex min-h-[2.5rem] flex-col">
                    <Link
                      to={scheduledUrl}
                      className="focus-ring card-lift hover:border-border-subtle bg-surface-hover/30 hover:bg-surface-hover/50 flex h-full min-h-[2.5rem] flex-col justify-center gap-1 rounded-lg border border-transparent px-2.5 py-1 sm:gap-1.5 sm:px-3 sm:py-1.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="text-text min-w-0 truncate text-xs font-medium">
                          {queueName}
                        </span>
                        <span
                          className={`flex-shrink-0 text-xs tabular-nums transition-opacity duration-200 ${bundle ? "font-bold opacity-70 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100 [.colors-revealed_&]:opacity-100" : "text-text-secondary"}`}
                          style={bundle ? { color: bundle.accent } : undefined}
                        >
                          {count}
                        </span>
                      </div>
                      <div
                        className={`h-2 min-w-0 overflow-hidden rounded-[1px] sm:h-2.5 ${bundle ? "" : "bg-surface-hover/30"}`}
                        role="presentation"
                        aria-hidden
                        style={
                          bundle
                            ? { backgroundColor: bundle.surface }
                            : undefined
                        }
                      >
                        <div
                          className={`h-full min-w-0 rounded-[1px] transition-[width,opacity] duration-200 ${accentHex ? "opacity-65 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100 [.colors-revealed_&]:opacity-100" : getBarFillClass(queueName)}`}
                          style={{
                            width: `${widthPercent}%`,
                            ...(accentHex
                              ? { backgroundColor: accentHex }
                              : undefined),
                          }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
