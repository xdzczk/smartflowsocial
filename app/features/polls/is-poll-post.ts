import type { SignedEvent } from "~/features/nostr/types";
import type { CombinedContent } from "~/features/posts/types";

import { KIND_POLL } from "./nip88";

/** True when this flow/calendar item is a NIP-88 poll (DB or signed event). */
export function isPollPostItem(
  item: Pick<CombinedContent, "type" | "postType"> & {
    /** Full event or minimal `{ kind }` from list rows / JSON partials */
    signedEvent?: SignedEvent | { kind?: number } | null;
  }
): boolean {
  if (item.type !== "post") return false;
  if (item.postType === "POLL") return true;
  return item.signedEvent?.kind === KIND_POLL;
}
