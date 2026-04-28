import { NativeCheckbox } from "~/components/ui/native-checkbox";
import { cn } from "~/lib/utils";

import {
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "../campaign-field-classes";
import { payoutCopy } from "../payout-copy";

export function PayoutMethodSelector({
  walletMode,
  autoPayEnabled,
  autoPayCapSats,
  nwcEnabled,
  autoPayLabel = payoutCopy.autoPayAfterLock,
}: {
  walletMode: "manual" | "nwc_creator";
  autoPayEnabled: boolean;
  autoPayCapSats: number | null | undefined;
  nwcEnabled: boolean;
  autoPayLabel?: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          {payoutCopy.payoutMethod}{" "}
          <select
            name="payoutWalletMode"
            defaultValue={walletMode}
            className={cn(campaignSelectClassNames, "ml-2 w-auto min-w-0")}
          >
            <option value="manual">Manual payout</option>
            <option value="nwc_creator" disabled={!nwcEnabled}>
              Wallet payout
            </option>
          </select>
        </label>
        {!nwcEnabled ? (
          <span className="text-text-secondary text-xs">
            Connect NWC in Settings to enable wallet payout.
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <NativeCheckbox
            name="payoutAutoRunEnabled"
            defaultChecked={autoPayEnabled}
            disabled={walletMode !== "nwc_creator" || !nwcEnabled}
            className="mr-2 shrink-0 align-middle"
          />
          {autoPayLabel}
        </label>
        <label className="text-sm">
          {payoutCopy.autoPayCap} (sats){" "}
          <input
            type="number"
            name="payoutAutoRunSpendCapSats"
            defaultValue={autoPayCapSats ?? ""}
            min={0}
            step={1}
            className={cn(campaignFieldClassNames, "ml-2 w-40")}
          />
        </label>
      </div>
    </>
  );
}
