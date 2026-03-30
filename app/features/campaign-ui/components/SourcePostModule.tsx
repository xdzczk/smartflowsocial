import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { CampaignSectionHeader } from "./CampaignSectionHeader";
import { ChoiceTileGroup } from "./ChoiceTileGroup";
import { CompactStatusMessage } from "./CompactStatusMessage";

const SOURCE_OPTIONS = [
  {
    value: "create" as const,
    title: "Create new contest post",
    description: "Compose the note replies will target.",
  },
  {
    value: "existing" as const,
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
}) {
  return (
    <section
      className={cn("space-y-4", className)}
      aria-labelledby={typeof id === "string" ? id : undefined}
    >
      <CampaignSectionHeader id={id} title={title} description={description} />
      <ChoiceTileGroup
        name="_contestSourceModeVisual"
        value={mode}
        onChange={(v) => {
          onModeChange(v);
        }}
        options={SOURCE_OPTIONS}
      />
      {errorMessage ? (
        <CompactStatusMessage variant="error">
          {errorMessage}
        </CompactStatusMessage>
      ) : null}
      <div className="border-border/60 space-y-4 border-t pt-4">
        {mode === "create" ? createBody : existingBody}
      </div>
    </section>
  );
}
