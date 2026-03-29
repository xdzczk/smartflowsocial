/**
 * Split note text into plain segments and detect URLs, nostr: links, bare npub1, and #hashtags.
 * Preserves line breaks as explicit tokens for rendering.
 */

export type PreviewNoteToken =
  | { kind: "text"; text: string; offset: number }
  | { kind: "br"; offset: number }
  | { kind: "url"; href: string; label: string; offset: number }
  | { kind: "nostr"; href: string; label: string; offset: number }
  | { kind: "hashtag"; label: string; offset: number };

function trimTrailingPunctuation(s: string): string {
  return s.replace(/[),.;:'\]}>]+$/u, "");
}

/** Bech32 body after prefix (lowercase alphanum). */
const BECH32_BODY = "[a-z0-9]+";
const NPUB_PREFIX = "npub1";
const NOSTR_SCHEME = new RegExp(
  `^nostr:((?:npub1|note1|nevent1|nprofile1|naddr1)${BECH32_BODY})`,
  "i"
);
const BARE_NPUB = new RegExp(`^(${NPUB_PREFIX}${BECH32_BODY})`, "i");

function njumpHrefForNostrEntity(entity: string): string {
  const e = entity.trim();
  if (!e) return "";
  return `https://njump.me/${encodeURIComponent(e)}`;
}

function tokenizeLine(line: string, baseOffset: number): PreviewNoteToken[] {
  const out: PreviewNoteToken[] = [];
  let pos = 0;

  const pushText = (t: string, startInLine: number) => {
    if (t.length === 0) return;
    const last = out[out.length - 1];
    if (last?.kind === "text") {
      last.text += t;
    } else {
      out.push({
        kind: "text",
        text: t,
        offset: baseOffset + startInLine,
      });
    }
  };

  while (pos < line.length) {
    const rest = line.slice(pos);

    const urlMatch = rest.match(/^https?:\/\/[^\s<>"']+/i);
    if (urlMatch) {
      const raw = urlMatch[0];
      const href = trimTrailingPunctuation(raw);
      out.push({
        kind: "url",
        href,
        label: raw.slice(0, href.length),
        offset: baseOffset + pos,
      });
      pos += raw.length;
      continue;
    }

    const nostrMatch = rest.match(NOSTR_SCHEME);
    if (nostrMatch) {
      const full = nostrMatch[0];
      const entity = nostrMatch[1] ?? "";
      const href = njumpHrefForNostrEntity(entity);
      out.push({
        kind: "nostr",
        href,
        label: full,
        offset: baseOffset + pos,
      });
      pos += full.length;
      continue;
    }

    const atWordStart = pos === 0 || /\s/u.test(line[pos - 1]!);
    if (atWordStart) {
      const npubMatch = rest.match(BARE_NPUB);
      if (npubMatch) {
        const full = npubMatch[1] ?? npubMatch[0];
        if (full.length >= NPUB_PREFIX.length + 20) {
          const href = njumpHrefForNostrEntity(full);
          out.push({
            kind: "nostr",
            href,
            label: full,
            offset: baseOffset + pos,
          });
          pos += full.length;
          continue;
        }
      }
    }

    if (atWordStart && rest[0] === "#") {
      const hashMatch = rest.match(/^#[^\s#]+/u);
      if (hashMatch) {
        out.push({
          kind: "hashtag",
          label: hashMatch[0],
          offset: baseOffset + pos,
        });
        pos += hashMatch[0].length;
        continue;
      }
    }

    pushText(rest[0]!, pos);
    pos += 1;
  }

  return out;
}

export function tokenizePreviewNoteText(text: string): PreviewNoteToken[] {
  const parts = text.split(/(\n)/);
  const out: PreviewNoteToken[] = [];
  let offset = 0;
  for (const part of parts) {
    if (part === "\n") {
      out.push({ kind: "br", offset });
      offset += 1;
    } else if (part.length > 0) {
      out.push(...tokenizeLine(part, offset));
      offset += part.length;
    }
  }
  return out;
}
