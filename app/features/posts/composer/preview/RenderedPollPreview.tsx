import { Badge } from "~/components/ui/badge";
import type { User } from "~/features/user";
import { cn } from "~/lib/utils";

import type { NormalizedPollPreview } from "./normalized-composer-preview.types";
import { PreviewAccountHeader } from "./PreviewAccountHeader";

export function RenderedPollPreview({
  data,
  user,
  optionKeys,
}: {
  data: NormalizedPollPreview;
  user: User | undefined;
  /** Stable ids aligned with `data.options` (same length). */
  optionKeys: string[];
}) {
  const modeLabel =
    data.mode === "multiple" ? "Multiple choice" : "Single choice";

  return (
    <article className="space-y-2.5">
      <PreviewAccountHeader user={user} />
      <div>
        <h3 className="text-text text-lg leading-snug font-semibold tracking-tight">
          {data.question}
        </h3>
        <p className="text-text-tertiary mt-1.5 text-[11px] font-normal">
          Poll · {modeLabel}
        </p>
        <ul className="mt-3 space-y-1.5">
          {data.options.map((opt, i) => (
            <li
              key={optionKeys[i] ?? `poll-opt-${i}`}
              className={cn(
                "bg-surface-hover/50 cluster-loose rounded-md px-3 py-2 text-sm",
                "border-border-subtle border"
              )}
            >
              <span
                className="bg-surface-hover text-text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="wrap-break-word leading-snug">{opt}</span>
            </li>
          ))}
        </ul>
        {data.hasPollEndDate ? (
          <p className="text-text-tertiary mt-2.5 text-[11px] leading-snug">
            {data.endLabel}
          </p>
        ) : null}
      </div>
      {data.hideTags ? (
        data.tags.length > 0 ? (
          <p className="text-text-tertiary text-xs">
            {data.tags.length} hidden topic tag
            {data.tags.length === 1 ? "" : "s"} included
          </p>
        ) : null
      ) : data.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs font-normal">
              #{t}
            </Badge>
          ))}
        </div>
      ) : null}
    </article>
  );
}
