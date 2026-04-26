import { useFetcher } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { campaignFieldClassNames } from "~/features/campaign-ui";
import { cn } from "~/lib/utils";

export function GiveawayDetailSavePresetForm() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" className="cluster">
      <input type="hidden" name="intent" value="savePreset" />
      <label htmlFor="presetName" className="text-text-secondary text-sm">
        Save as preset:
      </label>
      <input
        id="presetName"
        name="presetName"
        type="text"
        placeholder="Preset name"
        className={cn(campaignFieldClassNames, "max-w-xs")}
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={fetcher.state !== "idle"}
      >
        Save
      </Button>
    </fetcher.Form>
  );
}
