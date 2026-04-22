import { Copy } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

export interface TechnicalDetailsCollapsibleProps {
  eventId: string;
  pubkey: string;
  kind: number;
  createdAtUnix: number;
  tags: string[][];
  noteOrNevent?: string | null;
  className?: string;
}

async function copyText(text: string, onDone: () => void) {
  try {
    await navigator.clipboard.writeText(text);
    onDone();
  } catch {
    onDone();
  }
}

export function TechnicalDetailsCollapsible({
  eventId,
  pubkey,
  kind,
  createdAtUnix,
  tags,
  noteOrNevent,
  className,
}: TechnicalDetailsCollapsibleProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const flash = useCallback((key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  }, []);

  const tagSummary =
    tags.length > 0
      ? tags
          .slice(0, 12)
          .map((t) => t.join(":"))
          .join(" · ")
      : "—";

  return (
    <details
      className={cn(
        "border-border bg-surface group shadow-1 rounded-xl border",
        className
      )}
    >
      <summary className="text-text-secondary hover:bg-surface-hover/40 motion-fast cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Technical details
          <span className="text-text-secondary/80 text-xs font-normal">
            {copiedKey ? "Copied" : "Show"}
          </span>
        </span>
      </summary>
      <div className="border-border space-y-3 border-t px-4 py-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-text-secondary mb-1 text-[10px] font-semibold uppercase">
              Event ID (hex)
            </p>
            <code className="bg-surface-hover block rounded-md px-2 py-1.5 font-mono text-xs break-all">
              {eventId}
            </code>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 text-xs"
            onClick={() => {
              void copyText(eventId, () => flash("id"));
            }}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={INLINE_ICON_STROKE} />
            Copy
          </Button>
        </div>

        {noteOrNevent ? (
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-text-secondary mb-1 text-[10px] font-semibold uppercase">
                Note / nevent
              </p>
              <code className="bg-surface-hover block rounded-md px-2 py-1.5 font-mono text-xs break-all">
                {noteOrNevent}
              </code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2 text-xs"
              onClick={() => {
                void copyText(noteOrNevent, () => flash("n"));
              }}
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={INLINE_ICON_STROKE} />
              Copy
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-text-secondary mb-1 text-[10px] font-semibold uppercase">
              Author pubkey (hex)
            </p>
            <code className="bg-surface-hover block rounded-md px-2 py-1.5 font-mono text-xs break-all">
              {pubkey}
            </code>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 text-xs"
            onClick={() => {
              void copyText(pubkey, () => flash("pk"));
            }}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={INLINE_ICON_STROKE} />
            Copy
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-text-secondary mb-0.5 text-[10px] font-semibold uppercase">
              Kind
            </p>
            <p className="font-mono text-sm">{kind}</p>
          </div>
          <div>
            <p className="text-text-secondary mb-0.5 text-[10px] font-semibold uppercase">
              created_at
            </p>
            <p className="font-mono text-sm">{createdAtUnix}</p>
          </div>
        </div>

        <div>
          <p className="text-text-secondary mb-1 text-[10px] font-semibold uppercase">
            Tags (preview)
          </p>
          <code className="bg-surface-hover block max-h-32 overflow-auto rounded-md px-2 py-1.5 font-mono text-[11px] leading-relaxed break-all">
            {tagSummary}
          </code>
        </div>
      </div>
    </details>
  );
}
