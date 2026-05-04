import type { MetaDescriptor } from "@remix-run/node";

import { BRAND_APP_TITLE, BRAND_DESCRIPTION, BRAND_NAME } from "~/lib/brand";
import { absoluteUrl } from "~/lib/site-url";

/** Default Open Graph / Twitter preview image (1200×630). */
export const SEO_DEFAULT_OG_PATH = "/og/og-default.png";

export const SEO_OG_IMAGE_WIDTH = 1200;
export const SEO_OG_IMAGE_HEIGHT = 630;

/** `/plans` page description (indexable). */
export const SEO_PLANS_DESCRIPTION =
  "Compare SmartFlowSocial plans for Nostr-native publishing, multi-account workflows, media hosting, and advanced creator tools.";

/** Public contest page when no summary is available. */
export const SEO_PUBLIC_CONTEST_FALLBACK_DESCRIPTION =
  "View this public contest powered by SmartFlowSocial, the Nostr-native publishing operating system.";

export type SeoRobots =
  | "index, follow"
  | "noindex, follow"
  | "noindex, nofollow";

const SEO_ROBOTS_INDEX_FOLLOW: SeoRobots = "index, follow";

export interface SeoInput {
  /** Full document title; wins over `page`. */
  title?: string;
  /** Short page label; becomes `{page} | SmartFlowSocial` when `title` omitted. */
  page?: string;
  description?: string;
  robots?: SeoRobots;
  /** Path only, e.g. `/` or `/plans/contest/x`; joined with `siteOrigin`. */
  canonicalPath?: string;
  ogType?: "website" | "article";
  /** Absolute or site-relative image URL; defaults to `${siteOrigin}${SEO_DEFAULT_OG_PATH}`. */
  imageUrl?: string;
  /** Emit `meta[name=author]` (indexable pages). */
  includeAuthor?: boolean;
}

export interface BuildSeoMetaOptions {
  siteOrigin: string;
}

export function pageTitle(page?: string): string {
  if (!page?.trim()) {
    return BRAND_APP_TITLE;
  }
  return `${page.trim()} | ${BRAND_NAME}`;
}

function resolveTitle(input: SeoInput): string {
  if (input.title?.trim()) {
    return input.title.trim();
  }
  if (input.page?.trim()) {
    return pageTitle(input.page.trim());
  }
  return BRAND_APP_TITLE;
}

function resolveRobots(input: SeoInput): SeoRobots {
  return input.robots ?? SEO_ROBOTS_INDEX_FOLLOW;
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

/**
 * Build Remix `meta` descriptors for consistent SEO and social previews.
 */
export function buildSeoMeta(
  input: SeoInput,
  options: BuildSeoMetaOptions
): MetaDescriptor[] {
  const { siteOrigin } = options;
  const title = resolveTitle(input);
  const robots = resolveRobots(input);
  const indexable = robots === SEO_ROBOTS_INDEX_FOLLOW;
  const description = input.description?.trim();
  const ogType = input.ogType ?? "website";
  const trimmedImageRel = input.imageUrl?.trim();
  const relativeImagePath =
    trimmedImageRel && trimmedImageRel.length > 0
      ? trimmedImageRel
      : SEO_DEFAULT_OG_PATH;
  const imageAbs =
    input.imageUrl?.startsWith("http://") ||
    input.imageUrl?.startsWith("https://")
      ? input.imageUrl
      : absoluteUrl(siteOrigin, relativeImagePath);

  const out: MetaDescriptor[] = [{ title }];

  if (description) {
    out.push({ name: "description", content: description });
  }

  out.push({ name: "robots", content: robots });

  if (indexable && input.includeAuthor) {
    out.push({ name: "author", content: BRAND_NAME });
  }

  if (indexable && input.canonicalPath) {
    out.push({
      tagName: "link",
      rel: "canonical",
      href: absoluteUrl(siteOrigin, normalizePath(input.canonicalPath)),
    });
  }

  if (indexable) {
    out.push(
      { property: "og:title", content: title },
      ...(description
        ? [{ property: "og:description", content: description } as const]
        : []),
      { property: "og:type", content: ogType },
      { property: "og:image", content: imageAbs },
      {
        property: "og:image:width",
        content: String(SEO_OG_IMAGE_WIDTH),
      },
      {
        property: "og:image:height",
        content: String(SEO_OG_IMAGE_HEIGHT),
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      ...(description
        ? [{ name: "twitter:description", content: description } as const]
        : []),
      { name: "twitter:image", content: imageAbs }
    );
  }

  return out;
}

/** Root default: indexable marketing baseline (no canonical  -  added by `/` route). */
export function buildRootDefaultMeta(siteOrigin: string): MetaDescriptor[] {
  return buildSeoMeta(
    {
      title: BRAND_APP_TITLE,
      description: BRAND_DESCRIPTION,
      robots: SEO_ROBOTS_INDEX_FOLLOW,
      ogType: "website",
      includeAuthor: true,
    },
    { siteOrigin }
  );
}

/** Match slice used to read root `siteOrigin` from loader data (meta `matches` or `useMatches()`). */
export type SiteOriginMatchLike = Readonly<{
  id: string;
  data?: unknown;
}>;

/** Read `siteOrigin` from root loader data (for child route `meta`). */
export function siteOriginFromMatches(
  matches: readonly SiteOriginMatchLike[]
): string {
  const root = matches.find((m) => m.id === "root" || m.id === "routes/root");
  const d = root?.data as { siteOrigin?: string } | undefined;
  return typeof d?.siteOrigin === "string" ? d.siteOrigin : "http://localhost";
}
