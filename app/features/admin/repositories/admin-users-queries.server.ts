/**
 * Paginated user directory for Admin Users tab.
 */

import type { Prisma } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export type AdminUserSort = "createdAt" | "lastActive" | "published";

/** Heuristic lifecycle bucket for operators (not persisted). */
export type AdminUserSegment =
  | "new"
  | "activating"
  | "established"
  | "dormant"
  | "power"
  | "at_risk";

export interface AdminUserRow {
  id: string;
  npub: string;
  displayName: string | null;
  /** Nostr profile `picture` URL when present */
  pictureUrl: string | null;
  isEnabled: boolean;
  createdAt: string;
  planLabel: string;
  publishedPosts: number;
  scheduledPosts: number;
  mediaCount: number;
  referralCount: number;
  referralAttributed: boolean;
  lastActivityAt: string | null;
  firstPublishedAt: string | null;
  subscriptionStartedAt: string | null;
  recent7dPublishes: number;
  segment: AdminUserSegment;
}

export interface AdminUsersPageDTO {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  filter: string;
  sort: AdminUserSort;
  search: string;
}

const PAGE_SIZE = 30;

function profileBitsFromNostr(nostrProfile: unknown): {
  displayName: string | null;
  pictureUrl: string | null;
} {
  if (!nostrProfile) {
    return { displayName: null, pictureUrl: null };
  }
  try {
    let o: Record<string, unknown>;
    if (typeof nostrProfile === "string") {
      o = JSON.parse(nostrProfile) as Record<string, unknown>;
    } else if (typeof nostrProfile === "object") {
      o = nostrProfile as Record<string, unknown>;
    } else {
      return { displayName: null, pictureUrl: null };
    }
    const nameRaw =
      (typeof o["displayName"] === "string" && o["displayName"]) ||
      (typeof o["display_name"] === "string" && o["display_name"]) ||
      (typeof o["name"] === "string" && o["name"]) ||
      null;
    const displayName = nameRaw?.trim() ? nameRaw.trim() : null;
    const picture = o["picture"];
    const pictureUrl =
      typeof picture === "string" && picture.trim() ? picture.trim() : null;
    return { displayName, pictureUrl };
  } catch {
    return { displayName: null, pictureUrl: null };
  }
}

function minDate(
  a: Date | null | undefined,
  b: Date | null | undefined
): Date | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(
  a: Date | null | undefined,
  b: Date | null | undefined
): Date | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

function deriveSegment(args: {
  createdAt: Date;
  lastActivity: Date;
  publishedTotal: number;
  pub7d: number;
  planLabel: string;
}): AdminUserSegment {
  const { createdAt, lastActivity, publishedTotal, pub7d, planLabel } = args;
  const ageDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  const inactiveDays =
    (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
  const paid =
    planLabel !== "none" &&
    planLabel !== "inactive" &&
    planLabel !== "canceled";

  if (ageDays < 14 && publishedTotal === 0) return "new";
  if (publishedTotal >= 20 || pub7d >= 5) return "power";
  if (inactiveDays > 21 && publishedTotal > 0) return "dormant";
  if (paid && pub7d === 0 && publishedTotal >= 5) return "at_risk";
  if (ageDays < 30 && publishedTotal > 0 && publishedTotal < 10) {
    return "activating";
  }
  return "established";
}

interface UserActivityMaps {
  scheduledByUser: Map<string, number>;
  maxPubShort: Map<string, Date>;
  maxPubLong: Map<string, Date>;
  minPubShort: Map<string, Date>;
  minPubLong: Map<string, Date>;
  pub7dShort: Map<string, number>;
  pub7dLong: Map<string, number>;
}

function emptyActivityMaps(): UserActivityMaps {
  return {
    scheduledByUser: new Map(),
    maxPubShort: new Map(),
    maxPubLong: new Map(),
    minPubShort: new Map(),
    minPubLong: new Map(),
    pub7dShort: new Map(),
    pub7dLong: new Map(),
  };
}

async function loadUserActivityMaps(
  ids: string[],
  sevenAgo: Date
): Promise<UserActivityMaps> {
  if (ids.length === 0) {
    return emptyActivityMaps();
  }

  const [schedShort, schedLong, gMaxS, gMaxL, gMinS, gMinL, g7S, g7L] =
    await Promise.all([
      prisma.post.groupBy({
        by: ["userId"],
        where: {
          userId: { in: ids },
          currentState: { in: ["SCHEDULED", "PUBLISHING"] },
        },
        _count: { _all: true },
      }),
      prisma.longFormPost.groupBy({
        by: ["userId"],
        where: {
          userId: { in: ids },
          currentState: { in: ["SCHEDULED", "PUBLISHING"] },
        },
        _count: { _all: true },
      }),
      prisma.post.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, currentState: "PUBLISHED" },
        _max: { publishedAt: true },
      }),
      prisma.longFormPost.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, currentState: "PUBLISHED" },
        _max: { publishedAt: true },
      }),
      prisma.post.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, currentState: "PUBLISHED" },
        _min: { publishedAt: true },
      }),
      prisma.longFormPost.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, currentState: "PUBLISHED" },
        _min: { publishedAt: true },
      }),
      prisma.post.groupBy({
        by: ["userId"],
        where: {
          userId: { in: ids },
          currentState: "PUBLISHED",
          publishedAt: { gte: sevenAgo },
        },
        _count: { _all: true },
      }),
      prisma.longFormPost.groupBy({
        by: ["userId"],
        where: {
          userId: { in: ids },
          currentState: "PUBLISHED",
          publishedAt: { gte: sevenAgo },
        },
        _count: { _all: true },
      }),
    ]);

  const scheduledByUser = new Map<string, number>();
  const maxPubShort = new Map<string, Date>();
  const maxPubLong = new Map<string, Date>();
  const minPubShort = new Map<string, Date>();
  const minPubLong = new Map<string, Date>();
  const pub7dShort = new Map<string, number>();
  const pub7dLong = new Map<string, number>();

  for (const r of schedShort) {
    scheduledByUser.set(
      r.userId,
      (scheduledByUser.get(r.userId) ?? 0) + r._count._all
    );
  }
  for (const r of schedLong) {
    scheduledByUser.set(
      r.userId,
      (scheduledByUser.get(r.userId) ?? 0) + r._count._all
    );
  }
  for (const r of gMaxS) {
    if (r._max.publishedAt) {
      maxPubShort.set(r.userId, r._max.publishedAt);
    }
  }
  for (const r of gMaxL) {
    if (r._max.publishedAt) {
      maxPubLong.set(r.userId, r._max.publishedAt);
    }
  }
  for (const r of gMinS) {
    if (r._min.publishedAt) {
      minPubShort.set(r.userId, r._min.publishedAt);
    }
  }
  for (const r of gMinL) {
    if (r._min.publishedAt) {
      minPubLong.set(r.userId, r._min.publishedAt);
    }
  }
  for (const r of g7S) {
    pub7dShort.set(r.userId, r._count._all);
  }
  for (const r of g7L) {
    pub7dLong.set(r.userId, r._count._all);
  }

  return {
    scheduledByUser,
    maxPubShort,
    maxPubLong,
    minPubShort,
    minPubLong,
    pub7dShort,
    pub7dLong,
  };
}

function mergeUserSearchIntoWhere(
  where: Prisma.UserWhereInput,
  search: string
): void {
  const searchClause: Prisma.UserWhereInput = {
    OR: [
      { npub: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ],
  };
  const existing = where.AND;
  where.AND = existing
    ? Array.isArray(existing)
      ? [...existing, searchClause]
      : [existing, searchClause]
    : [searchClause];
}

function userListOrderBy(
  sort: AdminUserSort
): Prisma.UserOrderByWithRelationInput | undefined {
  if (sort === "published") return undefined;
  if (sort === "lastActive") return { updatedAt: "desc" };
  return { createdAt: "desc" };
}

export async function getAdminUsersPageData(options: {
  page?: number;
  filter?: string;
  sort?: string;
  search?: string;
}): Promise<AdminUsersPageDTO> {
  const page = Math.max(1, options.page ?? 1);
  const filter = options.filter ?? "all";
  const sort: AdminUserSort =
    options.sort === "published" || options.sort === "lastActive"
      ? options.sort
      : "createdAt";
  const search = (options.search ?? "").trim().toLowerCase();

  const referredNpubs =
    filter === "referred"
      ? (
          await prisma.referral.findMany({
            select: { referredNpub: true },
            distinct: ["referredNpub"],
          })
        ).map((r) => r.referredNpub)
      : null;

  const whereBase: Prisma.UserWhereInput = {};

  if (filter === "enabled") whereBase.isEnabled = true;
  if (filter === "disabled") whereBase.isEnabled = false;
  if (filter === "paid") {
    whereBase.Subscription = { status: SubscriptionStatus.ACTIVE };
  }
  if (filter === "referred") {
    const referredList = referredNpubs ?? [];
    if (referredList.length === 0) {
      return {
        users: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
        filter,
        sort:
          sort === "published" || sort === "lastActive" ? sort : "createdAt",
        search: options.search ?? "",
      };
    }
    whereBase.npub = { in: referredList };
  }

  const where: Prisma.UserWhereInput = { ...whereBase };
  if (search) {
    mergeUserSearchIntoWhere(where, search);
  }

  const total = await prisma.user.count({ where });

  const orderBy = userListOrderBy(sort);

  const skip = (page - 1) * PAGE_SIZE;

  const referralByReferrer = new Map<string, number>();
  const [refGroups, referredRows] = await Promise.all([
    prisma.referral.groupBy({
      by: ["referrerNpub"],
      _count: { _all: true },
    }),
    prisma.referral.findMany({ select: { referredNpub: true } }),
  ]);
  for (const g of refGroups) {
    referralByReferrer.set(g.referrerNpub, g._count._all);
  }
  const referredSet = new Set(referredRows.map((r) => r.referredNpub));

  const usersRaw = await prisma.user.findMany({
    where,
    orderBy: orderBy ?? { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      npub: true,
      nostrProfile: true,
      isEnabled: true,
      createdAt: true,
      updatedAt: true,
      engagementLastCheckedAt: true,
      nwcLastUsed: true,
      Subscription: {
        select: { status: true, plan: true, startDate: true, createdAt: true },
      },
      _count: {
        select: {
          notes: { where: { currentState: "PUBLISHED" } },
          longFormPosts: { where: { currentState: "PUBLISHED" } },
          media: true,
        },
      },
    },
  });

  const ids = usersRaw.map((u) => u.id);
  const now = new Date();
  const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const {
    scheduledByUser,
    maxPubShort,
    maxPubLong,
    minPubShort,
    minPubLong,
    pub7dShort,
    pub7dLong,
  } = await loadUserActivityMaps(ids, sevenAgo);

  let usersWithScheduled = usersRaw.map((u) => ({
    ...u,
    scheduledPosts: scheduledByUser.get(u.id) ?? 0,
    publishedPosts: u._count.notes + u._count.longFormPosts,
  }));

  if (sort === "published") {
    usersWithScheduled = [...usersWithScheduled].sort(
      (a, b) => b.publishedPosts - a.publishedPosts
    );
  }

  const users: AdminUserRow[] = usersWithScheduled.map((u) => {
    const bits = profileBitsFromNostr(u.nostrProfile);
    const sub = u.Subscription;
    const planLabel =
      sub?.status === SubscriptionStatus.ACTIVE
        ? (sub.plan?.trim() ?? "active")
        : sub
          ? String(sub.status).toLowerCase()
          : "none";

    const lastPub = maxDate(maxPubShort.get(u.id), maxPubLong.get(u.id));
    const firstPub = minDate(minPubShort.get(u.id), minPubLong.get(u.id));

    const lastActivity = maxDate(
      maxDate(u.updatedAt, u.engagementLastCheckedAt),
      maxDate(u.nwcLastUsed, lastPub)
    );

    const lastActivityAt = lastActivity ? lastActivity.toISOString() : null;
    const firstPublishedAt = firstPub ? firstPub.toISOString() : null;
    const subscriptionStartedAt = sub?.startDate
      ? sub.startDate.toISOString()
      : sub?.createdAt
        ? sub.createdAt.toISOString()
        : null;

    const recent7dPublishes =
      (pub7dShort.get(u.id) ?? 0) + (pub7dLong.get(u.id) ?? 0);

    const segment = deriveSegment({
      createdAt: u.createdAt,
      lastActivity: lastActivity ?? u.updatedAt,
      publishedTotal: u.publishedPosts,
      pub7d: recent7dPublishes,
      planLabel,
    });

    return {
      id: u.id,
      npub: u.npub,
      displayName: bits.displayName,
      pictureUrl: bits.pictureUrl,
      isEnabled: u.isEnabled,
      createdAt: u.createdAt.toISOString(),
      planLabel,
      publishedPosts: u.publishedPosts,
      scheduledPosts: u.scheduledPosts,
      mediaCount: u._count.media,
      referralCount: referralByReferrer.get(u.npub) ?? 0,
      referralAttributed: referredSet.has(u.npub),
      lastActivityAt,
      firstPublishedAt,
      subscriptionStartedAt,
      recent7dPublishes,
      segment,
    };
  });

  if (sort === "lastActive") {
    users.sort((a, b) =>
      (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "")
    );
  }

  return {
    users,
    total,
    page,
    pageSize: PAGE_SIZE,
    filter,
    sort: sort === "published" || sort === "lastActive" ? sort : "createdAt",
    search: options.search ?? "",
  };
}
