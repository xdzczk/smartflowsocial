import { useFetcher } from "@remix-run/react";

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
        className="border-border bg-canvas rounded-xs border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="border-border rounded-md border px-3 py-1 text-sm"
        disabled={fetcher.state !== "idle"}
      >
        Save
      </button>
    </fetcher.Form>
  );
}
