/**
 * Global Search Service
 * Searches across all content types: drafts, scheduled, publishing, posted, failed, cancelled, templates, and external posts
 */

import { prisma } from "~/lib/prisma.server";

import { handleSearchEvent } from "./search-action.server";

export interface GlobalSearchResult {
  type:
    | "draft"
    | "scheduled"
    | "publishing"
    | "posted"
    | "failed"
    | "cancelled"
    | "template"
    | "external";
  id: string;
  title?: string;
  caption?: string;
  content?: string;
  summary?: string;
  status: string;
  createdAt: string; // ISO string for JSON serialization
  updatedAt?: string; // ISO string for JSON serialization
  scheduledAt?: string; // ISO string for JSON serialization
  postedAt?: string; // ISO string for JSON serialization
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
  // Search regular posts
  const draftPosts = await prisma.post.findMany({
    where: {
      userId,
      currentState: "DRAFT",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

  // Search long-form posts
  const draftLongforms = await prisma.longFormPost.findMany({
    where: {
      userId,
      currentState: "DRAFT",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

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
  // Search regular posts
  const scheduledPosts = await prisma.post.findMany({
    where: {
      userId,
      currentState: "SCHEDULED",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { scheduledAtUtc: "asc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      scheduledAtUtc: true,
      currentState: true,
    },
  });

  // Search long-form posts
  const scheduledLongforms = await prisma.longFormPost.findMany({
    where: {
      userId,
      currentState: "SCHEDULED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { scheduledAtUtc: "asc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      scheduledAtUtc: true,
      currentState: true,
    },
  });

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
  // Search regular posts
  const postedPosts = await prisma.post.findMany({
    where: {
      userId,
      currentState: "PUBLISHED",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { postedAt: "desc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      postedAt: true,
      currentState: true,
    },
  });

  // Search long-form posts
  const postedLongforms = await prisma.longFormPost.findMany({
    where: {
      userId,
      currentState: "PUBLISHED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { postedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      postedAt: true,
      currentState: true,
    },
  });

  const results: GlobalSearchResult[] = [
    ...postedPosts.map((post: (typeof postedPosts)[number]) => ({
      type: "posted" as const,
      id: post.id,
      caption: post.caption ?? undefined,
      content: post.content ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      postedAt: post.postedAt?.toISOString(),
      url: `/dashboard/posted`,
      isLongform: false,
    })),
    ...postedLongforms.map((post: (typeof postedLongforms)[number]) => ({
      type: "posted" as const,
      id: post.id,
      title: post.title ?? undefined,
      content: post.content ?? undefined,
      summary: post.summary ?? undefined,
      status: post.currentState,
      createdAt: post.createdAt.toISOString(),
      postedAt: post.postedAt?.toISOString(),
      url: `/dashboard/posted`,
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
  // Search regular posts
  const publishingPosts = await prisma.post.findMany({
    where: {
      userId,
      currentState: "PUBLISHING",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

  // Search long-form posts
  const publishingLongforms = await prisma.longFormPost.findMany({
    where: {
      userId,
      currentState: "PUBLISHING",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

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
  // Search regular posts
  const failedPosts = await prisma.post.findMany({
    where: {
      userId,
      currentState: "FAILED",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

  // Search long-form posts
  const failedLongforms = await prisma.longFormPost.findMany({
    where: {
      userId,
      currentState: "FAILED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

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
  // Search regular posts
  const cancelledPosts = await prisma.post.findMany({
    where: {
      userId,
      currentState: "CANCELLED",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

  // Search long-form posts
  const cancelledLongforms = await prisma.longFormPost.findMany({
    where: {
      userId,
      currentState: "CANCELLED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      currentState: true,
    },
  });

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
  const templates = await prisma.template.findMany({
    where: {
      userId,
      name: { contains: query, mode: "insensitive" },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return templates.map((template: (typeof templates)[number]) => ({
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
 * Check if query looks like a Nostr event ID (note1, nevent1, or hex)
 */
function isNostrEventId(query: string): boolean {
  const trimmed = query.trim();
  return (
    trimmed.startsWith("note1") ||
    trimmed.startsWith("nevent1") ||
    /^[0-9a-f]{64}$/i.test(trimmed)
  );
}

/**
 * Perform global search across all content types
 */
export async function performGlobalSearch(
  userId: string,
  query: string,
  limitPerType = 5
): Promise<GlobalSearchResponse> {
  if (!query || query.trim() === "") {
    return { results: [], total: 0 };
  }

  const trimmedQuery = query.trim();

  // If it looks like a Nostr event ID, search external posts
  const isEventId = isNostrEventId(trimmedQuery);
  let externalResults: GlobalSearchResult[] = [];

  if (isEventId) {
    try {
      const externalResult = await handleSearchEvent(trimmedQuery);
      // handleSearchEvent always returns an object with event property if successful
      externalResults = [
        {
          type: "external",
          id: externalResult.event.id,
          content: externalResult.event.content,
          status: "external",
          createdAt: new Date(
            externalResult.event.created_at * 1000
          ).toISOString(),
          url: `/dashboard/search/posts?q=${encodeURIComponent(trimmedQuery)}`,
        },
      ];
    } catch {
      // If external search fails, continue with local search
    }
  }

  // Search all local content types in parallel
  const [drafts, scheduled, publishing, posted, failed, cancelled, templates] =
    await Promise.all([
      searchDrafts(userId, trimmedQuery, limitPerType),
      searchScheduled(userId, trimmedQuery, limitPerType),
      searchPublishing(userId, trimmedQuery, limitPerType),
      searchPosted(userId, trimmedQuery, limitPerType),
      searchFailed(userId, trimmedQuery, limitPerType),
      searchCancelled(userId, trimmedQuery, limitPerType),
      searchTemplates(userId, trimmedQuery, limitPerType),
    ]);

  // Combine all results
  const allResults: GlobalSearchResult[] = [
    ...drafts,
    ...scheduled,
    ...publishing,
    ...posted,
    ...failed,
    ...cancelled,
    ...templates,
    ...externalResults,
  ];

  return {
    results: allResults,
    total: allResults.length,
  };
}
