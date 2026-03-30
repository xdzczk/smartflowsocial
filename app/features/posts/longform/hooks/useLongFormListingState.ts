import { useCallback, useEffect, useMemo, useState } from "react";

import type { LongFormPostType } from "~/features/posts/server";
import type { LongFormPostData } from "~/features/posts/types";
import { difference, fromDate, nowInTimezone } from "~/lib/temporal";

import {
  getDefaultSortDirection,
  getDefaultSortKey,
  longFormMatchesSearch,
  sortLongFormPosts,
  type LongFormListingSortConfig,
} from "../utils/longform-listing-utils";

export type LongFormListingType = "draft" | "scheduled" | "published";

export interface UseLongFormListingStateParams {
  posts: Array<LongFormPostType | LongFormPostData>;
  type: LongFormListingType;
  searchTerm: string;
  userTimezone: string;
}

export function useLongFormListingState({
  posts,
  type,
  searchTerm,
  userTimezone,
}: UseLongFormListingStateParams) {
  const [sortConfig, setSortConfig] = useState<LongFormListingSortConfig>({
    key: getDefaultSortKey(type),
    direction: getDefaultSortDirection(type),
  });
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const clearSelection = useCallback(() => {
    setSelectedPosts(new Set());
  }, []);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  const sortedPosts = useMemo(
    () => sortLongFormPosts(posts, sortConfig),
    [posts, sortConfig]
  );
  const filteredPosts = useMemo(
    () => sortedPosts.filter((post) => longFormMatchesSearch(post, searchTerm)),
    [sortedPosts, searchTerm]
  );

  const requestSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    setSelectedPosts((prev) => {
      if (prev.size === filteredPosts.length) return new Set();
      return new Set(filteredPosts.map((post) => post.id));
    });
  };

  const postIds = useMemo(
    () => posts.map((post) => post.id).join(","),
    [posts]
  );

  useEffect(() => {
    if (type !== "scheduled") return;

    const updateCountdowns = () => {
      const now = nowInTimezone(userTimezone);
      const newCountdowns: Record<string, string> = {};

      posts.forEach((post) => {
        const scheduledAtUtcRaw = (post as { scheduledAtUtc?: unknown })
          .scheduledAtUtc;
        const scheduledAtUtc =
          scheduledAtUtcRaw instanceof Date
            ? scheduledAtUtcRaw
            : typeof scheduledAtUtcRaw === "string"
              ? new Date(scheduledAtUtcRaw)
              : null;
        if (!scheduledAtUtc || isNaN(scheduledAtUtc.getTime())) return;

        try {
          const scheduledZoned = fromDate(scheduledAtUtc, "UTC");
          const scheduledInUserTz = scheduledZoned.withTimeZone(userTimezone);
          const duration = difference(scheduledInUserTz, now);

          if (duration.sign === 1) {
            const days = Math.floor(duration.total({ unit: "days" }));
            const hours = Math.floor(duration.total({ unit: "hours" }) % 24);
            const minutes = Math.floor(
              duration.total({ unit: "minutes" }) % 60
            );
            newCountdowns[post.id] = `${days}d ${hours}h ${minutes}m`;
          } else {
            newCountdowns[post.id] = "Due now";
          }
        } catch {
          newCountdowns[post.id] = "Due now";
        }
      });

      setCountdowns((prev) => {
        const hasChanged =
          Object.keys(newCountdowns).some(
            (id) => prev[id] !== newCountdowns[id]
          ) || Object.keys(prev).length !== Object.keys(newCountdowns).length;
        return hasChanged ? newCountdowns : prev;
      });
    };

    updateCountdowns();
    const timer = setInterval(updateCountdowns, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- postIds used instead of posts to avoid infinite loops
  }, [postIds, userTimezone, type]);

  return {
    sortConfig,
    setSortConfig,
    requestSort,
    filteredPosts,
    selectedPosts,
    setSelectedPosts,
    clearSelection,
    togglePostSelection,
    toggleSelectAll,
    countdowns,
  };
}
