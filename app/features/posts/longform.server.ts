import { getPublicKey, finalizeEvent, nip19 } from "nostr-tools";

import { sanitizeMarkdown } from "~/lib/markdown-sanitizer.server";
import { nowSeconds } from "~/lib/temporal";

export function createLongFormEvent({
  privateKey,
  title,
  content,
  summary,
  image,
  tags = [],
  dTag,
  publishedAt,
}: {
  privateKey: string;
  title: string;
  content: string;
  summary?: string;
  image?: string;
  tags?: string[];
  dTag?: string;
  publishedAt?: number;
}) {
  // Convert privateKey (hex string or nsec) to Uint8Array
  let privateKeyBytes: Uint8Array;
  try {
    if (privateKey.startsWith("nsec")) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type === "nsec") {
        privateKeyBytes = decoded.data;
      } else {
        throw new Error("Invalid nsec format");
      }
    } else {
      // Assume hex string
      privateKeyBytes = new Uint8Array(
        privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
      );
    }
  } catch {
    // Fallback: treat as hex string
    privateKeyBytes = new Uint8Array(
      privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
    );
  }

  const publicKey = getPublicKey(privateKeyBytes);

  const eventTags = [];

  if (dTag) {
    eventTags.push(["d", dTag]);
  }

  if (title) {
    eventTags.push(["title", title]);
  }

  if (summary) {
    eventTags.push(["summary", summary]);
  }

  if (image) {
    eventTags.push(["image", image]);
  }

  if (publishedAt) {
    eventTags.push(["published_at", publishedAt.toString()]);
  }

  tags.forEach((tag) => {
    if (tag.trim()) {
      eventTags.push(["t", tag.trim().toLowerCase()]);
    }
  });

  const sanitizedContent = sanitizeMarkdown(content);

  const event = {
    kind: 30023,
    pubkey: publicKey,
    created_at: nowSeconds(),
    tags: eventTags,
    content: sanitizedContent,
  };

  return finalizeEvent(event, privateKeyBytes);
}

export function generateArticleIdentifier(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .substring(0, 64);
}
