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
    <article className="space-y-3">
      <PreviewAccountHeader user={user} />
      <div className="border-border/60 bg-muted/15 rounded-lg border p-3">
        <p className="text-foreground text-base leading-snug font-semibold">
          {data.question}
        </p>
        <p className="text-muted-foreground mt-2 text-[11px] font-medium tracking-wide uppercase">
          Poll · {modeLabel}
        </p>
        <ul className="mt-3 space-y-2">
          {data.options.map((opt, i) => (
            <li
              key={optionKeys[i] ?? `poll-opt-${i}`}
              className={cn(
                "border-border/50 bg-background/60 flex items-center rounded-md border px-3 py-2.5 text-sm",
                "shadow-none"
              )}
            >
              <span className="text-muted-foreground mr-2 w-5 shrink-0 text-xs tabular-nums">
                {i + 1}
              </span>
              <span className="wrap-break-word leading-snug">{opt}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">{data.endLabel}</p>
      </div>
      {data.hideTags ? (
        data.tags.length > 0 ? (
          <p className="text-muted-foreground/85 text-xs">
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
