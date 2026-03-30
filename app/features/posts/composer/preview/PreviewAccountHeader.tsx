import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import type { User } from "~/features/user";
import { formatNpubShort } from "~/lib/nostr-conversion";
import { cn } from "~/lib/utils";

function getParsedNostrProfile(user: User): Record<string, unknown> | null {
  const raw = user.nostrProfile;
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw))
    return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function previewDisplayName(user: User | undefined): string {
  if (!user) return "You";
  const p = getParsedNostrProfile(user);
  if (p) {
    const name = p["name"];
    const displayName = p["display_name"];
    if (name != null && String(name).trim() !== "") return String(name).trim();
    if (displayName != null && String(displayName).trim() !== "")
      return String(displayName).trim();
  }
  return formatNpubShort(user.npub);
}

function previewPicture(user: User | undefined): string | undefined {
  if (!user) return undefined;
  const p = getParsedNostrProfile(user);
  const pic = p?.["picture"];
  return typeof pic === "string" && pic.length > 0 ? pic : undefined;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}

export function PreviewAccountHeader({
  user,
  timeLabel,
  className,
}: {
  user: User | undefined;
  /** Optional secondary line (e.g. timestamp). Omitted in composer previews. */
  timeLabel?: string;
  className?: string;
}) {
  const name = previewDisplayName(user);
  const picture = previewPicture(user);
  return (
    <div className={cn("mb-2.5 flex items-center gap-2.5", className)}>
      <Avatar className="border-border/50 h-9 w-9 border">
        {picture ? <AvatarImage src={picture} alt="" /> : null}
        <AvatarFallback className="text-xs font-medium">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm leading-tight font-semibold">
          {name}
        </p>
        {timeLabel != null && timeLabel !== "" ? (
          <p className="text-muted-foreground/70 mt-0.5 text-[11px] leading-tight">
            {timeLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
