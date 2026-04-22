import { cn } from "~/lib/utils";

export type NostrResignNoticeVariant = "scheduleChange" | "contentChange";

const COPY: Record<NostrResignNoticeVariant, { title: string; body: string }> =
  {
    scheduleChange: {
      title: "Re-signing required",
      body: "Changing this scheduled post will require your Nostr signer to approve an updated event.",
    },
    contentChange: {
      title: "Re-signing required",
      body: "Saving these changes will require your Nostr signer to approve an updated event.",
    },
  };

export function NostrResignNotice({
  variant,
  className,
}: {
  variant: NostrResignNoticeVariant;
  className?: string;
}) {
  const { title, body } = COPY[variant];
  return (
    <div
      className={cn(
        "border-border bg-surface-hover/40 rounded-lg border px-3 py-2.5",
        className
      )}
    >
      <p className="text-text text-sm font-medium">{title}</p>
      <p className="text-text-secondary mt-1 text-xs leading-relaxed">{body}</p>
    </div>
  );
}
