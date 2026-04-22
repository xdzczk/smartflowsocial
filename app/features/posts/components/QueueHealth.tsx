import { Link } from "@remix-run/react";
import { useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import {
  getQueueAccentHex,
  getQueueColorBundle,
  type QueueColorBundle,
} from "../queue-colors";
import type { QueueType } from "../types";

const QUEUE_COLOR_CSS_VAR = "--queue-color";

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
  /** True when onboarding is complete but dashboard has no scheduled/published activity yet. */
  isPostActivationEmpty?: boolean;
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
  isPostActivationEmpty = false,
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
      className={`focus-ring group flex min-w-0 flex-1 flex-col focus-visible:ring-inset ${colorsRevealed ? "colors-revealed" : ""}`}
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
      <Card className="shadow-1 flex min-w-0 flex-1 flex-col dark:shadow-none">
        <CardHeader className="px-4 pt-2 pb-1.5">
          <h3 className="text-text text-[11px] font-medium tracking-tight uppercase">
            Queue Health
          </h3>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pt-0 pb-3">
          {countsByQueue.length === 0 ? (
            <div className="flex min-h-[12rem] flex-col justify-center gap-2">
              <p className="text-text-secondary text-xs">
                {isPostActivationEmpty
                  ? "Queues appear here once you start adding scheduled content."
                  : "No queues with scheduled posts."}
              </p>
              {isPostActivationEmpty ? (
                <Link
                  to="/dashboard/compose?type=post"
                  className="focus-ring text-brand hover:text-brand/90 w-fit rounded-xs text-xs font-medium underline"
                >
                  Schedule first post
                </Link>
              ) : null}
            </div>
          ) : (
            <ul
              className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 ${
                countsByQueue.length <= 6 ? "justify-evenly" : ""
              }`}
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
                const linkStyle:
                  | (CSSProperties & Record<string, string>)
                  | undefined = bundle
                  ? { [QUEUE_COLOR_CSS_VAR]: bundle.accent }
                  : undefined;

                return (
                  <li key={queueName} className="flex min-h-[2.75rem] flex-col">
                    <Link
                      to={scheduledUrl}
                      className={`focus-ring card-lift bg-surface-hover/30 hover:bg-surface-hover/50 flex h-full min-h-[2.75rem] flex-col justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-shadow ${bundle ? "queue-health-row" : ""}`}
                      style={linkStyle}
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
                        className={`h-2.5 min-w-0 overflow-hidden rounded-[1px] ${bundle ? "" : "bg-surface-hover/30"}`}
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
