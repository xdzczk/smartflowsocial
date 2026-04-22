import { useFetcher } from "@remix-run/react";

export function GiveawayDetailExcludeWinnerForm({
  giveawayId: _giveawayId,
  winnerPubkey,
}: {
  giveawayId: string;
  winnerPubkey: string;
}) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="exclude" />
      <input type="hidden" name="winnerPubkey" value={winnerPubkey} />
      <button
        type="submit"
        className="text-text-secondary hover:text-danger text-xs"
        disabled={fetcher.state !== "idle"}
      >
        Exclude
      </button>
    </fetcher.Form>
  );
}
