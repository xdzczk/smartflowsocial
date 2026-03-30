import { Link } from "@remix-run/react";
import { Copy, ExternalLink } from "lucide-react";
import { nip19 } from "nostr-tools";
import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";
import { eventUrl } from "~/lib/nostr-client-urls";

import type { ResolvedPostCardData } from "./ResolvedPostCard";

export interface LookupCopySectionProps {
  result: ResolvedPostCardData;
  nostrClientConfig: NostrClientConfig;
  viewEventLabel: string;
  noteOrNeventDisplay: string | null;
}

export function LookupCopySection({
  result,
  nostrClientConfig,
  viewEventLabel,
  noteOrNeventDisplay,
}: LookupCopySectionProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const flash = useCallback((k: string) => {
    setCopied(k);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const npub = useMemo(() => {
    try {
      return nip19.npubEncode(result.pubkey);
    } catch {
      return result.pubkey;
    }
  }, [result.pubkey]);

  const externalUrl = eventUrl(result.id, nostrClientConfig);

  const copy = useCallback(
    async (label: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(label);
      } catch {
        flash(label);
      }
    },
    [flash]
  );

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start gap-2 px-3 text-xs"
        asChild
      >
        <Link to={externalUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          View on {viewEventLabel}
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start gap-2 px-3 text-xs"
        onClick={() => {
          void copy("hex", result.id);
        }}
      >
        <Copy className="h-3.5 w-3.5" strokeWidth={INLINE_ICON_STROKE} />
        {copied === "hex" ? "Copied" : "Copy Event ID"}
      </Button>
      {noteOrNeventDisplay ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full justify-start gap-2 px-3 text-xs"
          onClick={() => {
            void copy("nv", noteOrNeventDisplay);
          }}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={INLINE_ICON_STROKE} />
          {copied === "nv" ? "Copied" : "Note / nevent"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start gap-2 px-3 text-xs"
        onClick={() => {
          void copy("npub", npub);
        }}
      >
        <Copy className="h-3.5 w-3.5" strokeWidth={INLINE_ICON_STROKE} />
        {copied === "npub" ? "Copied" : "Copy Author npub"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start gap-2 px-3 text-xs"
        asChild
      >
        <Link to={externalUrl} target="_blank" rel="noopener noreferrer">
          Open external URL
        </Link>
      </Button>
    </div>
  );
}
