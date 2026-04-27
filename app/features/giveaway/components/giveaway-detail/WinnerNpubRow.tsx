import { useState } from "react";
import { toast } from "react-hot-toast";

export function WinnerNpubRow({
  npub,
  displayName,
  picture,
  onCopy,
  profileUrl,
}: {
  npub: string;
  displayName?: string | null;
  picture?: string | null;
  onCopy?: () => void;
  profileUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast.success("Copied npub");
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  const trimmedName = displayName?.trim() ?? "";
  const primaryLabel =
    trimmedName !== ""
      ? trimmedName
      : npub.length > 24
        ? `${npub.slice(0, 20)}…${npub.slice(-8)}`
        : npub;
  const showNpubSecondary = Boolean(displayName?.trim());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {picture ? (
        <img
          src={picture}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
          width={32}
          height={32}
        />
      ) : (
        <div
          className="bg-surface-hover text-text-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
          aria-hidden
        >
          {(displayName?.trim() ?? "").slice(0, 1).toUpperCase() || "?"}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className="text-text truncate text-sm font-medium"
          title={showNpubSecondary ? npub : undefined}
        >
          {primaryLabel}
        </span>
        {showNpubSecondary ? (
          <span
            className="text-text-secondary truncate font-mono text-xs"
            title={npub}
          >
            {npub.length > 24 ? `${npub.slice(0, 12)}…${npub.slice(-8)}` : npub}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className="text-text-secondary hover:text-text shrink-0 text-xs"
          aria-label="Copy npub"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link shrink-0 text-xs"
        >
          Profile
        </a>
      </div>
    </div>
  );
}
