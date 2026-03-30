import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";

export function DetailModalReplySnippet({
  reply,
  metadata,
}: {
  reply: ChildReply;
  metadata: Record<string, unknown>;
}) {
  const meta = metadata[reply.pubkey];
  let name = reply.pubkey.slice(0, 8) + "…";
  if (
    meta &&
    typeof meta === "object" &&
    !Array.isArray(meta) &&
    "content" in meta
  ) {
    try {
      const raw = (meta as { content?: unknown }).content;
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const d =
          typeof p["display_name"] === "string" ? p["display_name"] : undefined;
        const n = typeof p["name"] === "string" ? p["name"] : undefined;
        name = d ?? n ?? name;
      }
    } catch {
      /* ignore */
    }
  }
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
