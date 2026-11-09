import sharp from "sharp";

import { redis } from "~/infra/queue/queue-client.server";
import { logWarning } from "~/lib/error-logger.server";

import { findAvatarSubject } from "./repositories/public-stats-data.server";
import { profileBits, safeImageUrl } from "./stats-payload";

const MAX_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const MAX_REDIRECTS = 3;

export function avatarCacheKey(npub: string): string {
  return `smartflow:public-avatar:${npub}`;
}

interface CachedAvatar {
  contentType: string;
  body: string;
}

async function readLimited(response: Response): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchImage(start: URL): Promise<Buffer | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "image/*" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const next = safeImageUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return readLimited(response);
  }
  return null;
}

export async function renderAvatar(npub: string): Promise<Response> {
  const user = await findAvatarSubject(npub);
  if (!user || user.hideFromLanding) {
    return new Response("Not found", { status: 404 });
  }
  const picture = profileBits(user.nostrProfile).picture;
  const source = picture ? safeImageUrl(picture) : null;
  if (!source) return new Response("Not found", { status: 404 });

  const key = avatarCacheKey(npub);
  try {
    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedAvatar;
      return new Response(Buffer.from(parsed.body, "base64"), {
        headers: {
          "content-type": parsed.contentType,
          "cache-control": "public, max-age=86400",
        },
      });
    }
  } catch (error) {
    logWarning("Avatar cache read failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let bytes: Buffer | null;
  try {
    bytes = await fetchImage(source);
  } catch (error) {
    logWarning("Avatar fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Not found", { status: 404 });
  }
  if (!bytes) return new Response("Not found", { status: 404 });

  let webp: Buffer;
  try {
    webp = await sharp(bytes, { limitInputPixels: 16_777_216 })
      .rotate()
      .resize(96, 96, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    logWarning("Avatar resize failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Not found", { status: 404 });
  }

  const payload: CachedAvatar = {
    contentType: "image/webp",
    body: webp.toString("base64"),
  };
  try {
    await redis.set(key, JSON.stringify(payload), "EX", CACHE_TTL_SECONDS);
  } catch (error) {
    logWarning("Avatar cache write failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return new Response(new Uint8Array(webp), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=86400",
    },
  });
}

export async function dropAvatarCache(npub: string): Promise<void> {
  try {
    await redis.del(avatarCacheKey(npub));
  } catch (error) {
    logWarning("Avatar cache delete failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
