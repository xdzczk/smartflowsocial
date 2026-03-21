/**
 * Paginated user directory for Admin Users tab.
 */

import type { Prisma } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export type AdminUserSort = "createdAt" | "lastActive" | "published";

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

  const total = await prisma.user.count({ where });

  const orderBy =
    sort === "published"
      ? undefined
      : sort === "lastActive"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

  const skip = (page - 1) * PAGE_SIZE;

  const referralByReferrer = new Map<string, number>();
  const refGroups = await prisma.referral.groupBy({
    by: ["referrerNpub"],
    _count: { _all: true },
  });
  for (const g of refGroups) {
    referralByReferrer.set(g.referrerNpub, g._count._all);
  }

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
      Subscription: { select: { status: true, plan: true } },
      _count: {
        select: {
          notes: { where: { currentState: "PUBLISHED" } },
          longFormPosts: { where: { currentState: "PUBLISHED" } },
          media: true,
        },
      },
    },
  });

  let usersWithScheduled = await Promise.all(
    usersRaw.map(async (u) => {
      const scheduled = await prisma.post.count({
        where: {
          userId: u.id,
          currentState: { in: ["SCHEDULED", "PUBLISHING"] },
        },
      });
      const longSched = await prisma.longFormPost.count({
        where: {
          userId: u.id,
          currentState: { in: ["SCHEDULED", "PUBLISHING"] },
        },
      });
      return {
        ...u,
        scheduledPosts: scheduled + longSched,
        publishedPosts: u._count.notes + u._count.longFormPosts,
      };
    })
  );

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
    };
  });

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
