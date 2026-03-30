import {
  CampaignSectionHeader,
  campaignSelectClassNames,
} from "~/features/campaign-ui";

export function GiveawayNewBuilderSelection({
  selectionMode,
  setSelectionMode,
  isFollowGraphScope,
}: {
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  setSelectionMode: (v: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT") => void;
  isFollowGraphScope: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="sel-heading">
      <CampaignSectionHeader
        id="sel-heading"
        title="4. Winner selection"
        description={
          isFollowGraphScope
            ? "Random draw from your graph pool after filters (one entry per account)."
            : "How weighted entries become winners after filters."
        }
      />
      {isFollowGraphScope ? (
        <>
          <input type="hidden" name="selectionMode" value="UNIQUE_USER" />
          <p className="text-muted-foreground text-xs leading-snug">
            One entry per account; pool is your follow graph at lock time.
          </p>
        </>
      ) : (
        <div className="max-w-md space-y-1">
          <label
            htmlFor="selectionMode"
            className="text-muted-foreground text-sm font-medium"
          >
            Selection mode
          </label>
          <select
            id="selectionMode"
            name="selectionMode"
            value={selectionMode}
            onChange={(e) => {
              setSelectionMode(
                e.target.value === "WEIGHTED_BY_ENGAGEMENT"
                  ? "WEIGHTED_BY_ENGAGEMENT"
                  : "UNIQUE_USER"
              );
            }}
            className={campaignSelectClassNames}
          >
            <option value="UNIQUE_USER">
              Unique user (one entry per pubkey)
            </option>
            <option value="WEIGHTED_BY_ENGAGEMENT">
              Weighted by engagement
            </option>
          </select>
        </div>
      )}
      <p className="text-muted-foreground/90 text-[11px] leading-snug">
        {isFollowGraphScope
          ? "Preview winners before lock; locked giveaways cannot be edited."
          : "Preview before lock — locked giveaways cannot be edited."}
      </p>
    </section>
  );
}
