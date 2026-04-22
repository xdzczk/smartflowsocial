import { Button } from "~/components/ui/button";

import type { GiveawayNewBuilderProps } from "./giveaway-new-builder-types";

export function GiveawayNewBuilderPresetTemplates({
  planLimits,
  presets,
}: Pick<GiveawayNewBuilderProps, "planLimits" | "presets">) {
  if (!planLimits.canUsePresets) {
    return (
      <section
        className="border-border/50 mt-8 border-t pt-5"
        aria-labelledby="preset-templates-heading"
      >
        <h2
          id="preset-templates-heading"
          className="text-text-secondary text-xs font-medium tracking-wide uppercase"
        >
          Presets
        </h2>
        <p className="text-text-secondary mt-2 text-xs leading-snug">
          Upgrade your plan to save and reuse giveaway templates.
        </p>
      </section>
    );
  }

  if (presets.length === 0) {
    return (
      <section
        className="border-border/50 mt-8 border-t pt-4"
        aria-labelledby="preset-templates-heading"
      >
        <div className="bg-surface-hover/25 text-text-secondary rounded-md px-3 py-2 text-xs leading-snug">
          <span className="text-text/90 font-medium">Presets</span> — none yet.
          Save one from a giveaway detail page to start here next time.
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-border/60 space-y-3 border-t pt-8"
      aria-labelledby="preset-templates-heading"
    >
      <h2
        id="preset-templates-heading"
        className="text-text-secondary text-sm font-medium"
      >
        Start from preset
      </h2>
      <ul className="flex flex-col gap-2">
        {presets.map((p) => (
          <li key={p.id}>
            <form
              method="post"
              className="flex flex-wrap items-center justify-between gap-2 py-1"
            >
              <input type="hidden" name="intent" value="createFromPreset" />
              <input type="hidden" name="presetId" value={p.id} />
              <span className="text-text text-sm">
                {p.name}{" "}
                <span className="text-text-secondary">
                  · {p.scopeType} · {p.winnerCount} winner
                  {p.winnerCount !== 1 ? "s" : ""}
                </span>
              </span>
              <Button
                type="submit"
                variant="link"
                size="sm"
                className="h-auto p-0"
              >
                Use
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
