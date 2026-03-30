import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { CampaignSectionHeader } from "./CampaignSectionHeader";
import { ChoiceTileGroup, type ChoiceTileOption } from "./ChoiceTileGroup";
import { CompactStatusMessage } from "./CompactStatusMessage";

const DEFAULT_SOURCE_OPTIONS: ReadonlyArray<
  ChoiceTileOption<"create" | "existing">
> = [
  {
    value: "create",
    title: "Create new contest post",
    description: "Compose the note replies will target.",
  },
  {
    value: "existing",
    title: "Use existing published post",
    description: "Pick a note that is already live.",
  },
];

export function SourcePostModule({
  id,
  title,
  description,
  mode,
  onModeChange,
  createBody,
  existingBody,
  errorMessage,
  className,
  options = DEFAULT_SOURCE_OPTIONS,
  choiceGroupName = "_contestSourceModeVisual",
  compactTiles = false,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  mode: "create" | "existing";
  onModeChange: (next: "create" | "existing") => void;
  createBody: ReactNode;
  existingBody: ReactNode;
  /** Inline validation for missing source, etc. */
  errorMessage?: string | null;
  className?: string;
  /** Override tile labels (e.g. giveaway vs contest). */
  options?: ReadonlyArray<ChoiceTileOption<"create" | "existing">>;
  /** Distinct name when multiple source pickers could exist on one page. */
  choiceGroupName?: string;
  /** Shorter mode tiles + tighter body connection (contest/giveaway). */
  compactTiles?: boolean;
}) {
  return (
    <section
      className={cn("space-y-4", className)}
      aria-labelledby={typeof id === "string" ? id : undefined}
    >
      <CampaignSectionHeader id={id} title={title} description={description} />
      <ChoiceTileGroup
        name={choiceGroupName}
        value={mode}
        onChange={(v) => {
          onModeChange(v);
        }}
        options={options}
        compact={Boolean(compactTiles)}
      />
      {errorMessage ? (
        <CompactStatusMessage variant="error">
          {errorMessage}
        </CompactStatusMessage>
      ) : null}
      <div
        className={cn(
          "border-border/60 border-t",
          compactTiles ? "space-y-3 pt-3" : "space-y-4 pt-4"
        )}
      >
        {mode === "create" ? createBody : existingBody}
      </div>
    </section>
  );
}
