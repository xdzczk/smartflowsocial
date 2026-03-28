import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { railFieldClassNames } from "~/features/posts/components/publishing-rail";
import type { RepostConditions } from "~/features/posts/types";
import { cn } from "~/lib/utils";

const thresholdInputClass = cn("h-9 w-[4.5rem]", railFieldClassNames);

function toNum(val: string): number | undefined {
  const n = parseInt(val, 10);
  return val.trim() === ""
    ? undefined
    : Number.isNaN(n)
      ? undefined
      : Math.max(0, n);
}

export function FollowUpRepostConditionsEditor({
  repostConditions,
  onRepostConditionsChange,
  disabled,
  className,
}: {
  repostConditions: RepostConditions | null;
  onRepostConditionsChange: (value: RepostConditions | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const rc = repostConditions ?? {};

  const patch = (partial: RepostConditions | null) => {
    onRepostConditionsChange(partial);
  };

  return (
    <div
      className={cn(
        "border-border/60 bg-muted/15 space-y-2 rounded-md border px-2 py-2",
        className
      )}
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <Label className="text-muted-foreground text-[10px] font-medium">
            Reactions
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="—"
            value={rc.minReactions ?? ""}
            onChange={(e) => {
              const v = toNum(e.target.value);
              if (v !== undefined) {
                patch({ ...rc, minReactions: v });
              } else {
                const next = { ...rc };
                delete next.minReactions;
                patch(Object.keys(next).length > 0 ? next : null);
              }
            }}
            disabled={disabled}
            className={thresholdInputClass}
            aria-label="Min reactions"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-muted-foreground text-[10px] font-medium">
            Zaps
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="—"
            value={rc.minZaps ?? ""}
            onChange={(e) => {
              const v = toNum(e.target.value);
              if (v !== undefined) {
                patch({ ...rc, minZaps: v });
              } else {
                const next = { ...rc };
                delete next.minZaps;
                patch(Object.keys(next).length > 0 ? next : null);
              }
            }}
            disabled={disabled}
            className={thresholdInputClass}
            aria-label="Min zaps"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-muted-foreground text-[10px] font-medium">
            Comments
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="—"
            value={rc.minComments ?? ""}
            onChange={(e) => {
              const v = toNum(e.target.value);
              if (v !== undefined) {
                patch({ ...rc, minComments: v });
              } else {
                const next = { ...rc };
                delete next.minComments;
                patch(Object.keys(next).length > 0 ? next : null);
              }
            }}
            disabled={disabled}
            className={thresholdInputClass}
            aria-label="Min comments"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-muted-foreground text-[10px] font-medium">
            Reposts
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="—"
            value={rc.minReposts ?? ""}
            onChange={(e) => {
              const v = toNum(e.target.value);
              if (v !== undefined) {
                patch({ ...rc, minReposts: v });
              } else {
                const next = { ...rc };
                delete next.minReposts;
                patch(Object.keys(next).length > 0 ? next : null);
              }
            }}
            disabled={disabled}
            className={thresholdInputClass}
            aria-label="Min reposts"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-muted-foreground text-[10px] font-medium">
            Sats
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="—"
            value={rc.minSats ?? ""}
            onChange={(e) => {
              const v = toNum(e.target.value);
              if (v !== undefined) {
                patch({ ...rc, minSats: v });
              } else {
                const next = { ...rc };
                delete next.minSats;
                patch(Object.keys(next).length > 0 ? next : null);
              }
            }}
            disabled={disabled}
            className={cn("h-9 w-20", railFieldClassNames)}
            aria-label="Min sats"
          />
        </div>
      </div>
    </div>
  );
}
