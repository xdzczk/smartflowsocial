/**
 * Global Search Service
 * Searches across all content types: drafts, scheduled, publishing, posted, failed, cancelled, templates, external posts, and features
 */

import { getUserSubscription } from "~/features/payments/data";
import {
  hasFeatureAccess,
  type FeatureName,
  type UserSubscription,
} from "~/features/payments/types";
import { extractNostrIdentifier } from "~/lib/extract-nostr-identifier";

import {
  findCancelledLongforms,
  findCancelledPosts,
  findDraftLongforms,
  findDraftPosts,
  findFailedLongforms,
  findFailedPosts,
  findLongFormPostByNostrEventId,
  findPostByNostrEventId,
  findPublishedLongforms,
  findPublishedPosts,
  findPublishingLongforms,
  findPublishingPosts,
  findScheduledLongforms,
  findScheduledPosts,
  findTemplatesByQuery,
} from "../repositories/global-search-data.server";

import { decodeSearchInput, handleSearchEvent } from "./search-action.server";

export interface GlobalSearchResult {
  type:
    | "draft"
    | "scheduled"
    | "publishing"
    | "published"
    | "failed"
    | "cancelled"
    | "template"
    | "external"
    | "feature";
  id: string;
  title?: string;
  caption?: string;
  content?: string;
  summary?: string;
  status: string;
  createdAt: string; // ISO string for JSON serialization
  updatedAt?: string; // ISO string for JSON serialization
  scheduledAt?: string; // ISO string for JSON serialization
  publishedAt?: string; // ISO string for JSON serialization
  url: string;
  isLongform?: boolean;
}

export interface GlobalSearchResponse {
  results: GlobalSearchResult[];
  total: number;
}

/**
 * Search drafts (Post and LongFormPost with currentState = 'DRAFT')
 */
async function searchDrafts(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const [draftPosts, draftLongforms] = await Promise.all([
    findDraftPosts(userId, query, limit),
    findDraftLongforms(userId, query, limit),
  ]);

  const results: GlobalSearchResult[] = [
    ...draftPosts.map((post: (typeof draftPosts)[number]) => ({
      type: "draft" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/drafts/edit/${post.id}`,
      isLongform: false,
    })),
    ...draftLongforms.map((post: (typeof draftLongforms)[number]) => ({
      type: "draft" as const,
      id: post.id,
      title: post.title ?? undefined,
      content: post.content ?? undefined,
      summary: post.summary ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/drafts/longform/edit/${post.id}`,
      isLongform: true,
    })),
  ];

  return results.slice(0, limit);
}

/**
 * Search scheduled posts (Post and LongFormPost with currentState = 'SCHEDULED')
 */
async function searchScheduled(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const [scheduledPosts, scheduledLongforms] = await Promise.all([
    findScheduledPosts(userId, query, limit),
    findScheduledLongforms(userId, query, limit),
  ]);

  const results: GlobalSearchResult[] = [
    ...scheduledPosts.map((post: (typeof scheduledPosts)[number]) => ({
      type: "scheduled" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      scheduledAt: post.scheduledAtUtc?.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: false,
    })),
    ...scheduledLongforms.map((post: (typeof scheduledLongforms)[number]) => ({
      type: "scheduled" as const,
      id: post.id,
      title: post.title ?? undefined,
      content: post.content ?? undefined,
      summary: post.summary ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      scheduledAt: post.scheduledAtUtc?.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: true,
    })),
  ];

  return results.slice(0, limit);
}

/**
 * Search posted content (Post and LongFormPost with currentState = 'PUBLISHED')
 */
async function searchPosted(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const [postedPosts, postedLongforms] = await Promise.all([
    findPublishedPosts(userId, query, limit),
    findPublishedLongforms(userId, query, limit),
  ]);

  const results: GlobalSearchResult[] = [
    ...postedPosts.map((post: (typeof postedPosts)[number]) => ({
      type: "published" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString(),
      url: `/dashboard/published`,
      isLongform: false,
    })),
    ...postedLongforms.map((post: (typeof postedLongforms)[number]) => ({
      type: "published" as const,
      id: post.id,
      title: post.title ?? undefined,
      content: post.content ?? undefined,
      summary: post.summary ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString(),
      url: `/dashboard/published`,
      isLongform: true,
    })),
  ];

  return results.slice(0, limit);
}

/**
 * Search publishing posts (Post and LongFormPost with currentState = 'PUBLISHING')
 */
async function searchPublishing(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const [publishingPosts, publishingLongforms] = await Promise.all([
    findPublishingPosts(userId, query, limit),
    findPublishingLongforms(userId, query, limit),
  ]);

  const results: GlobalSearchResult[] = [
    ...publishingPosts.map((post: (typeof publishingPosts)[number]) => ({
      type: "publishing" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: false,
    })),
    ...publishingLongforms.map(
      (post: (typeof publishingLongforms)[number]) => ({
        type: "publishing" as const,
        id: post.id,
        title: post.title ?? undefined,
        content: post.content ?? undefined,
        summary: post.summary ?? undefined,
        status: post.currentState,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        url: `/dashboard/scheduled`,
        isLongform: true,
      })
    ),
  ];

  return results.slice(0, limit);
}

/**
 * Search failed posts (Post and LongFormPost with currentState = 'FAILED')
 */
async function searchFailed(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const [failedPosts, failedLongforms] = await Promise.all([
    findFailedPosts(userId, query, limit),
    findFailedLongforms(userId, query, limit),
  ]);

  const results: GlobalSearchResult[] = [
    ...failedPosts.map((post: (typeof failedPosts)[number]) => ({
      type: "failed" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: false,
    })),
    ...failedLongforms.map((post: (typeof failedLongforms)[number]) => ({
      type: "failed" as const,
      id: post.id,
      title: post.title ?? undefined,
      content: post.content ?? undefined,
      summary: post.summary ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: true,
    })),
  ];

  return results.slice(0, limit);
}

/**
 * Search cancelled posts (Post and LongFormPost with currentState = 'CANCELLED')
 */
async function searchCancelled(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const [cancelledPosts, cancelledLongforms] = await Promise.all([
    findCancelledPosts(userId, query, limit),
    findCancelledLongforms(userId, query, limit),
  ]);

  const results: GlobalSearchResult[] = [
    ...cancelledPosts.map((post: (typeof cancelledPosts)[number]) => ({
      type: "cancelled" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: false,
    })),
    ...cancelledLongforms.map((post: (typeof cancelledLongforms)[number]) => ({
      type: "cancelled" as const,
      id: post.id,
      title: post.title ?? undefined,
      content: post.content ?? undefined,
      summary: post.summary ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      url: `/dashboard/scheduled`,
      isLongform: true,
    })),
  ];

  return results.slice(0, limit);
}

/**
 * Search templates
 */
async function searchTemplates(
  userId: string,
  query: string,
  limit = 5
): Promise<GlobalSearchResult[]> {
  const templates = await findTemplatesByQuery(userId, query, limit);

  return templates.map((template) => ({
    type: "template" as const,
    id: template.id,
    title: template.name ?? undefined,
    status: "template",
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    url: `/dashboard/templates/edit/${template.id}`,
  }));
}

/**
 * Check if query looks like or contains a Nostr event/address (direct id or URL from Primal/Coracle etc.)
 */
function isNostrEventId(query: string): boolean {
  return extractNostrIdentifier(query.trim()) !== null;
}

/**
 * Find the user's own posts (Post or LongFormPost) by Nostr event ID (hex).
 * Returns results so the user can jump to their published/scheduled/draft from a pasted event link.
 */
async function findOwnPostsByNostrEventId(
  userId: string,
  eventIdHex: string
): Promise<GlobalSearchResult[]> {
  const results: GlobalSearchResult[] = [];

  const [post, longform] = await Promise.all([
    findPostByNostrEventId(userId, eventIdHex),
    findLongFormPostByNostrEventId(userId, eventIdHex),
  ]);

  const toType = (state: string): GlobalSearchResult["type"] => {
    switch (state) {
      case "PUBLISHED":
        return "published";
      case "SCHEDULED":
        return "scheduled";
      case "PUBLISHING":
        return "publishing";
      case "DRAFT":
        return "draft";
      case "FAILED":
        return "failed";
      case "CANCELLED":
        return "cancelled";
      default:
        return "published";
    }
  };

  if (post) {
    const type = toType(post.currentState);
    const url =
      type === "published"
        ? `/dashboard/published?postId=${post.id}`
        : type === "scheduled" || type === "publishing"
          ? `/dashboard/scheduled?postId=${post.id}`
          : type === "draft"
            ? `/dashboard/drafts/edit/${post.id}`
            : type === "failed" || type === "cancelled"
              ? `/dashboard/scheduled`
              : `/dashboard/published?postId=${post.id}`;
    results.push({
      type,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString(),
      scheduledAt: post.scheduledAtUtc?.toISOString(),
      url,
      isLongform: false,
    });
  }

  if (longform) {
    const type = toType(longform.currentState);
    const url =
      type === "published"
        ? `/dashboard/published?postId=${longform.id}&tab=longform`
        : type === "scheduled" || type === "publishing"
          ? `/dashboard/scheduled?postId=${longform.id}`
          : type === "draft"
            ? `/dashboard/drafts/longform/edit/${longform.id}`
            : type === "failed" || type === "cancelled"
              ? `/dashboard/scheduled`
              : `/dashboard/published?postId=${longform.id}&tab=longform`;
    results.push({
      type,
      id: longform.id,
      title: longform.title ?? undefined,
      content: longform.content ?? undefined,
      summary: longform.summary ?? undefined,
      status: longform.currentState,
      createdAt: longform.createdAt.toISOString(),
      updatedAt: longform.updatedAt.toISOString(),
      publishedAt: longform.publishedAt?.toISOString(),
      scheduledAt: longform.scheduledAtUtc?.toISOString(),
      url,
      isLongform: true,
    });
  }

  return results;
}

/**
 * Feature definitions for search
 */
interface FeatureDefinition {
  label: string;
  url: string;
  feature: FeatureName;
  keywords: string[]; // Additional search keywords
}

const FEATURES: FeatureDefinition[] = [
  {
    label: "Dashboard",
    url: "/dashboard",
    feature: "dashboard",
    keywords: ["home", "main", "overview"],
  },
  {
    label: "New Post",
    url: "/dashboard/newpost",
    feature: "newPost",
    keywords: ["create", "new", "post", "compose"],
  },
  {
    label: "New Long-form",
    url: "/dashboard/newlongformpost",
    feature: "longformPosts",
    keywords: ["long", "form", "article", "blog", "create"],
  },
  {
    label: "Bulk Posts",
    url: "/dashboard/bulkposts",
    feature: "bulkScheduling",
    keywords: ["bulk", "schedule", "multiple", "batch"],
  },
  {
    label: "Drafts",
    url: "/dashboard/drafts",
    feature: "drafts",
    keywords: ["draft", "unsaved", "unpublished"],
  },
  {
    label: "Templates",
    url: "/dashboard/templates",
    feature: "templates",
    keywords: ["template", "preset", "reuse"],
  },
  {
    label: "Calendar",
    url: "/dashboard/calendar",
    feature: "calendar",
    keywords: ["schedule", "view", "timeline"],
  },
  {
    label: "Scheduled",
    url: "/dashboard/scheduled",
    feature: "scheduled",
    keywords: ["upcoming", "queued", "pending"],
  },
  {
    label: "Published",
    url: "/dashboard/published",
    feature: "published",
    keywords: ["published", "sent", "history"],
  },
  {
    label: "Engagement Feed",
    url: "/dashboard/engagement/feed",
    feature: "engagement_feed",
    keywords: ["engagement", "feed", "activity", "interactions"],
  },
  {
    label: "Giveaways",
    url: "/dashboard/giveaway",
    feature: "giveaways",
    keywords: ["giveaway", "giveaways", "contest", "promotion"],
  },
  {
    label: "Contests",
    url: "/dashboard/contests",
    feature: "contests",
    keywords: ["contest", "leaderboard", "ranked", "replies"],
  },
  {
    label: "Broadcasts",
    url: "/dashboard/broadcasts",
    feature: "broadcasts",
    keywords: ["broadcast", "dm", "audience", "message", "schedule"],
  },
  {
    label: "Settings",
    url: "/dashboard/settings",
    feature: "settings",
    keywords: ["preferences", "config", "options", "account"],
  },
];

/**
 * Search features based on query and user permissions
 */
async function searchFeatures(
  userId: string,
  query: string,
  limit = 10
): Promise<GlobalSearchResult[]> {
  const trimmedQuery = query.toLowerCase();
  const subscription = await getUserSubscription(userId);
  const userSubscription: UserSubscription | null = subscription?.planId
    ? {
        planId: subscription.planId,
        status: subscription.status,
        Plan: subscription.Plan
          ? {
              name: subscription.Plan.name,
              id: subscription.Plan.id,
            }
          : undefined,
      }
    : null;

  // Filter features that match the query and user has access to
  const matchingFeatures = FEATURES.filter((feature) => {
    // Check if user has access to this feature
    if (!hasFeatureAccess(userSubscription, feature.feature)) {
      return false;
    }

    // Check if query matches label or keywords
    const labelMatch = feature.label.toLowerCase().includes(trimmedQuery);
    const keywordMatch = feature.keywords.some((keyword) =>
      keyword.toLowerCase().includes(trimmedQuery)
    );

    return labelMatch || keywordMatch;
  });

  // Sort by relevance (exact label match first, then keyword matches)
  const sortedFeatures = matchingFeatures.sort((a, b) => {
    const aLabelMatch = a.label.toLowerCase().includes(trimmedQuery);
    const bLabelMatch = b.label.toLowerCase().includes(trimmedQuery);
    if (aLabelMatch && !bLabelMatch) return -1;
    if (!aLabelMatch && bLabelMatch) return 1;
    return a.label.localeCompare(b.label);
  });

  // Limit results
  const limitedFeatures = sortedFeatures.slice(0, limit);

  // Convert to GlobalSearchResult format
  return limitedFeatures.map((feature) => ({
    type: "feature" as const,
    id: feature.url,
    title: feature.label,
    status: "feature",
    createdAt: new Date().toISOString(), // Features don't have dates, use current time
    url: feature.url,
  }));
}

/** Context from current page to prioritize matching result types first */
export type GlobalSearchPriorityContext =
  | "draft"
  | "scheduled"
  | "published"
  | "template";

/**
 * Perform global search across all content types.
 * When priorityContext is set (e.g. from current page), results of that type are ordered first after features.
 */
export async function performGlobalSearch(
  userId: string,
  query: string,
  limitPerType = 5,
  priorityContext?: string | null
): Promise<GlobalSearchResponse> {
  if (!query || query.trim() === "") {
    return { results: [], total: 0 };
  }

  const trimmedQuery = query.trim();

  // If it looks like a Nostr event ID, look up own posts by event id and optionally fetch external event
  const isEventId = isNostrEventId(trimmedQuery);
  let externalResults: GlobalSearchResult[] = [];

  if (isEventId) {
    const normalizedQuery =
      extractNostrIdentifier(trimmedQuery) ?? trimmedQuery;
    let eventIdHex: string | null = null;
    try {
      const decoded = decodeSearchInput(normalizedQuery);
      if (decoded.type === "event_id") eventIdHex = decoded.eventId;
    } catch {
      // Invalid format; will only try external search below
    }

    const [ownPosts, externalResult] = await Promise.all([
      eventIdHex != null ? findOwnPostsByNostrEventId(userId, eventIdHex) : [],
      (async () => {
        try {
          const data = await handleSearchEvent(normalizedQuery);
          return {
            type: "external" as const,
            id: data.event.id,
            content: data.event.content,
            status: "external",
            createdAt: new Date(data.event.created_at * 1000).toISOString(),
            url: `/dashboard/search/posts?q=${encodeURIComponent(normalizedQuery)}`,
          };
        } catch {
          return null;
        }
      })(),
    ]);

    if (ownPosts.length > 0) externalResults.push(...ownPosts);
    if (externalResult) externalResults.push(externalResult);
  }

  // Search all local content types and features in parallel
  const [
    drafts,
    scheduled,
    publishing,
    posted,
    failed,
    cancelled,
    templates,
    features,
  ] = await Promise.all([
    searchDrafts(userId, trimmedQuery, limitPerType),
    searchScheduled(userId, trimmedQuery, limitPerType),
    searchPublishing(userId, trimmedQuery, limitPerType),
    searchPosted(userId, trimmedQuery, limitPerType),
    searchFailed(userId, trimmedQuery, limitPerType),
    searchCancelled(userId, trimmedQuery, limitPerType),
    searchTemplates(userId, trimmedQuery, limitPerType),
    searchFeatures(userId, trimmedQuery, 10), // Show up to 10 features
  ]);

  // Build segments in default order; then reorder so priority context type comes right after features
  const segments: Array<{
    type: GlobalSearchResult["type"];
    results: GlobalSearchResult[];
  }> = [
    { type: "draft", results: drafts },
    { type: "scheduled", results: scheduled },
    { type: "publishing", results: publishing },
    { type: "published", results: posted },
    { type: "failed", results: failed },
    { type: "cancelled", results: cancelled },
    { type: "template", results: templates },
  ];

  const validContext =
    priorityContext === "draft" ||
    priorityContext === "scheduled" ||
    priorityContext === "published" ||
    priorityContext === "template"
      ? priorityContext
      : null;

  let allResults: GlobalSearchResult[];
  if (validContext) {
    const prioritySegment = segments.find((s) => s.type === validContext);
    const rest = segments.filter((s) => s.type !== validContext);
    const restFlat = rest.flatMap((s) => s.results);
    allResults = [
      ...features,
      ...(prioritySegment?.results ?? []),
      ...restFlat,
      ...externalResults,
    ];
  } else {
    allResults = [
      ...features,
      ...drafts,
      ...scheduled,
      ...publishing,
      ...posted,
      ...failed,
      ...cancelled,
      ...templates,
      ...externalResults,
    ];
  }

  return {
    results: allResults,
    total: allResults.length,
  };
}
