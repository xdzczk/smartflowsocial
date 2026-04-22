import { Fragment, useMemo } from "react";

import { cn } from "~/lib/utils";

import {
  tokenizePreviewNoteText,
  type PreviewNoteToken,
} from "./tokenize-preview-note-text";

function tokenElementKey(t: PreviewNoteToken): string {
  switch (t.kind) {
    case "text":
      return `${t.offset}-text-${t.text.length}`;
    case "br":
      return `${t.offset}-br`;
    case "url":
      return `${t.offset}-url-${t.href}`;
    case "nostr":
      return `${t.offset}-nostr-${t.label}`;
    case "hashtag":
      return `${t.offset}-tag-${t.label}`;
  }
}

function renderPreviewNoteTokens(tokens: PreviewNoteToken[]) {
  return tokens.map((t) => {
    const key = tokenElementKey(t);
    switch (t.kind) {
      case "text":
        return <Fragment key={key}>{t.text}</Fragment>;
      case "br":
        return <br key={key} />;
      case "url":
        return (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand decoration-brand/40 hover:decoration-brand font-medium underline underline-offset-2"
          >
            {t.label}
          </a>
        );
      case "nostr":
        return t.href ? (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand decoration-brand/40 hover:decoration-brand font-medium underline underline-offset-2"
          >
            {t.label}
          </a>
        ) : (
          <span key={key} className="text-brand font-medium">
            {t.label}
          </span>
        );
      case "hashtag":
        return (
          <span key={key} className="text-brand font-medium">
            {t.label}
          </span>
        );
      default:
        return null;
    }
  });
}

/** Note body with preserved line breaks; URLs, nostr identifiers, and #hashtags styled. */
export function PreviewNoteBody({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const tokens = useMemo(() => tokenizePreviewNoteText(text), [text]);

  if (!text.trim()) return null;

  return (
    <div
      className={cn(
        "text-text wrap-break-word text-[15px] leading-[1.55] whitespace-pre-wrap",
        className
      )}
    >
      {renderPreviewNoteTokens(tokens)}
    </div>
  );
}
