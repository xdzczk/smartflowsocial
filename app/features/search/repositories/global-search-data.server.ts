/**
 * Global search data access. All prisma usage for search is confined here.
 */

import { prisma } from "~/lib/prisma.server";

// --- Drafts
export async function findDraftPosts(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.post.findMany({
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
}

export async function findDraftLongforms(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.longFormPost.findMany({
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
}

// --- Scheduled
export async function findScheduledPosts(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.post.findMany({
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
}

export async function findScheduledLongforms(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.longFormPost.findMany({
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
}

// --- Published
export async function findPublishedPosts(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.post.findMany({
    where: {
      userId,
      currentState: "PUBLISHED",
      OR: [
        { caption: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      caption: true,
      content: true,
      createdAt: true,
      publishedAt: true,
      currentState: true,
    },
  });
}

export async function findPublishedLongforms(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.longFormPost.findMany({
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
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      createdAt: true,
      publishedAt: true,
      currentState: true,
    },
  });
}

// --- Publishing
export async function findPublishingPosts(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.post.findMany({
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
}

export async function findPublishingLongforms(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.longFormPost.findMany({
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
}

// --- Failed
export async function findFailedPosts(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.post.findMany({
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
}

export async function findFailedLongforms(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.longFormPost.findMany({
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
}

// --- Cancelled
export async function findCancelledPosts(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.post.findMany({
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
}

export async function findCancelledLongforms(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.longFormPost.findMany({
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
}

// --- Templates
export async function findTemplatesByQuery(
  userId: string,
  query: string,
  limit: number
) {
  return prisma.template.findMany({
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
}

// --- By Nostr event ID
export async function findPostByNostrEventId(
  userId: string,
  eventIdHex: string
) {
  return prisma.post.findFirst({
    where: { userId, nostrEventId: eventIdHex },
    select: {
      id: true,
      caption: true,
      content: true,
      currentState: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      scheduledAtUtc: true,
    },
  });
}

export async function findLongFormPostByNostrEventId(
  userId: string,
  eventIdHex: string
) {
  return prisma.longFormPost.findFirst({
    where: { userId, nostrEventId: eventIdHex },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      currentState: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      scheduledAtUtc: true,
    },
  });
}
