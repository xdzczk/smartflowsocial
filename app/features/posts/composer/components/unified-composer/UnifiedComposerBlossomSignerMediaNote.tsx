import { Link } from "@remix-run/react";

import { cn } from "~/lib/utils";

/** Inline callout when Blossom uploads are blocked (no NIP-07 / NIP-46). */
export function UnifiedComposerBlossomSignerMediaNote() {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2 text-[11px] leading-snug",
        "border-warning/45 bg-warning/12 text-warning-text"
      )}
    >
      <span className="font-medium">Media uploads disabled</span>
      {" — "}
      Blossom storage needs a{" "}
      <span className="font-medium">browser extension</span> (NIP-07) or a{" "}
      <span className="font-medium">connected remote signer</span> (NIP-46).
      Open{" "}
      <Link
        to="/dashboard/settings"
        className="text-link hover:text-link-hover font-medium underline underline-offset-2"
      >
        Settings
      </Link>{" "}
      to connect. Text-only posts still work.
    </div>
  );
}
