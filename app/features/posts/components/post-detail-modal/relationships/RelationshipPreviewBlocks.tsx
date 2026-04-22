import { Link } from "@remix-run/react";
import { ChevronRight } from "lucide-react";

import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

const box = cn(
  "border-border/80 bg-surface-hover/30 rounded-md border px-2.5 py-2 text-xs leading-snug"
);

export function InReplyToBlock({
  authorLine,
  snippet,
  viewThreadUrl,
}: {
  authorLine: string | null;
  snippet: string | null;
  viewThreadUrl: string;
}) {
  return (
    <div className={box}>
      {authorLine ? (
        <p className="text-text mb-1 font-medium">{authorLine}</p>
      ) : null}
      {snippet ? (
        <p className="text-text-secondary line-clamp-3 whitespace-pre-wrap">
          {snippet}
        </p>
      ) : (
        <p className="text-text-secondary italic">Preview unavailable</p>
      )}
      <Link
        to={viewThreadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium hover:underline"
      >
        View thread
        <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
      </Link>
    </div>
  );
}

export function QuotedPostBlock({
  authorLine,
  snippet,
  openUrl,
  hasMediaHint,
}: {
  authorLine: string | null;
  snippet: string | null;
  openUrl: string | null;
  hasMediaHint?: boolean;
}) {
  return (
    <div className={box}>
      {authorLine ? (
        <p className="text-text mb-1 font-medium">{authorLine}</p>
      ) : null}
      {snippet ? (
        <p className="text-text-secondary line-clamp-3 whitespace-pre-wrap">
          {snippet}
        </p>
      ) : (
        <p className="text-text-secondary italic">Preview unavailable</p>
      )}
      {hasMediaHint ? (
        <p className="text-text-secondary/80 mt-1 text-[10px]">Has media</p>
      ) : null}
      {openUrl ? (
        <Link
          to={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium hover:underline"
        >
          Open quoted post
          <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function RepostedPostBlock({
  authorLine,
  snippet,
  openUrl,
}: {
  authorLine: string | null;
  snippet: string | null;
  openUrl: string | null;
}) {
  return (
    <div className={box}>
      {authorLine ? (
        <p className="text-text mb-1 font-medium">{authorLine}</p>
      ) : null}
      {snippet ? (
        <p className="text-text-secondary line-clamp-3 whitespace-pre-wrap">
          {snippet}
        </p>
      ) : (
        <p className="text-text-secondary italic">Preview unavailable</p>
      )}
      {openUrl ? (
        <Link
          to={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium hover:underline"
        >
          Open reposted post
          <ChevronRight className={INLINE_ICON_SIZE_CLASS} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function ThreadContextBlock({ positionLine }: { positionLine: string }) {
  return (
    <div className={box}>
      <p className="text-text text-xs font-medium">{positionLine}</p>
      <p className="text-text-secondary mt-1 text-[11px] leading-snug">
        Thread order is shown in the panel on the left.
      </p>
    </div>
  );
}
