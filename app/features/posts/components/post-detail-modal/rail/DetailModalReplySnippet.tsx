import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";

import { getPubkeyDisplayName } from "../author-metadata";

export function DetailModalReplySnippet({
  reply,
  metadata,
}: {
  reply: ChildReply;
  metadata: Record<string, unknown>;
}) {
  const name = getPubkeyDisplayName(reply.pubkey, metadata);
  const body = reply.content.trim();
  const snippet = body.slice(0, 140);
  const ell = body.length > 140 ? "…" : "";
  return (
    <div className="border-border/60 border-l-2 pl-2">
      <p className="text-foreground text-xs font-medium">{name}</p>
      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs whitespace-pre-wrap">
        {snippet}
        {ell}
      </p>
    </div>
  );
}
