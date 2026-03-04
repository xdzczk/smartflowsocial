import { useFetcher } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

import { logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  NOSTR_CONNECTION_HEALTHY_EVENT,
  tryBackgroundReconnect,
} from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  addDays,
  addHours,
  createZonedDateTime,
  formatForDateTimeLocal,
  fromDate,
  getNowForDateTimeLocal,
  nowInTimezone,
  parseDateTimeLocal,
  toDate,
  toUnixTimestamp,
} from "~/lib/temporal";

import { getQueueAccentHex, getSelectedQueueStyle } from "../queue-colors";
import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";
import type { QueueType, PostData } from "../types";

interface DraftBulkResumeProps {
  selectedDrafts: PostData[];
  queueTypes: QueueType[];
  onCancel: () => void;
}

export default function DraftBulkResume({
  selectedDrafts,
  queueTypes,
  onCancel,
}: DraftBulkResumeProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  const scheduleIntervals =
    user && typeof user === "object" && "scheduleInterval" in user
      ? user.scheduleInterval
      : null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  // After successful remote signer reconnect, clear stuck signing state so user can retry.
  useEffect(() => {
    const handler = () => {
      setIsSubmitting(false);
      setSigningError(null);
    };
    window.addEventListener(NOSTR_CONNECTION_HEALTHY_EVENT, handler);
    return () =>
      window.removeEventListener(NOSTR_CONNECTION_HEALTHY_EVENT, handler);
  }, []);

  // When awaiting signer approval, try background reconnect after a delay.
  useEffect(() => {
    if (!isSubmitting) return;
    const t = setTimeout(() => void tryBackgroundReconnect(), 10_000);
    return () => clearTimeout(t);
  }, [isSubmitting]);

  // State for bulk operations similar to bulkposts
  const [posts, setPosts] = useState(
    selectedDrafts.map((draft, index) => {
      const userTimezone = user?.timezone ?? "UTC";
      const now = nowInTimezone(userTimezone);

      // Schedule posts with 2-hour intervals by default
      const hoursToAdd = index * (Number(scheduleIntervals?.[0]) || 2);
      const scheduledZoned = addHours(now, hoursToAdd);
      const scheduledFor = formatForDateTimeLocal(scheduledZoned, userTimezone);
      return {
        id: draft.id,
        content: draft.content ?? draft.caption,
        caption: draft.caption,
        fileUrl: draft.fileUrl,
        postType: draft.postType,
        queueType: draft.queueType?.name ?? draft.queueType ?? "unassigned",
        scheduledFor,
      };
    })
  );

  // ============================================================================
  // Helper Functions
  // ============================================================================

  // formatDateTimeLocal is now replaced by formatForDateTimeLocal from temporal
  // Keeping this wrapper for backward compatibility (currently unused)

  const getIntervalHours = (
    config: unknown,
    currentUser: typeof user
  ): number => {
    if (!isIntervalScheduleConfig(config)) {
      return 4; // default
    }

    if (config.useGlobalInterval) {
      const userIntervalRaw =
        currentUser &&
        typeof currentUser === "object" &&
        "scheduleInterval" in currentUser &&
        Array.isArray(currentUser.scheduleInterval) &&
        currentUser.scheduleInterval.length > 0
          ? currentUser.scheduleInterval[0]
          : null;
      const userInterval =
        typeof userIntervalRaw === "number"
          ? userIntervalRaw
          : typeof userIntervalRaw === "string"
            ? Number(userIntervalRaw)
            : null;
      return userInterval && !isNaN(userInterval) ? userInterval : 4;
    }

    return config.intervalHours ?? 4;
  };

  const calculateIntervalOffset = (
    baseDate: Date,
    baseIndex: number,
    config: unknown,
    userData: typeof user
  ): Date => {
    const intervalHours = getIntervalHours(config, userData);
    const baseZoned = fromDate(baseDate, "UTC");
    const offsetZoned = addHours(baseZoned, baseIndex * intervalHours);
    return toDate(offsetZoned);
  };

  interface ParsedSlot {
    slot: string;
    hours: number;
    minutes: number;
    totalMinutes: number;
  }

  const parseAndSortSlots = (slots: string[]): ParsedSlot[] => {
    return slots
      .map((slot: string) => {
        const parts = slot.split(":");
        const hours = parts[0] ? Number(parts[0]) : 0;
        const minutes = parts[1] ? Number(parts[1]) : 0;
        return {
          slot,
          hours,
          minutes,
          totalMinutes: hours * 60 + minutes,
        };
      })
      .sort((a: ParsedSlot, b: ParsedSlot) => a.totalMinutes - b.totalMinutes);
  };

  const calculateFixedSlotsOffset = (
    baseDate: Date,
    baseIndex: number,
    slots: string[]
  ): Date => {
    if (slots.length === 0) {
      return baseDate;
    }

    const sortedSlots = parseAndSortSlots(slots);

    // Get the current slot index based on the base time
    const baseZoned1 = fromDate(baseDate, "UTC");
    const baseTotalMinutes = baseZoned1.hour * 60 + baseZoned1.minute;

    let currentSlotIndex = 0;
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      if (slot && slot.totalMinutes >= baseTotalMinutes) {
        currentSlotIndex = i;
        break;
      }
    }

    // Calculate which slot this post should use
    const targetSlotIndex = (currentSlotIndex + baseIndex) % sortedSlots.length;
    const targetSlot = sortedSlots[targetSlotIndex];

    if (!targetSlot) {
      return baseDate;
    }

    // Calculate how many days to add
    const daysToAdd = Math.floor(
      (currentSlotIndex + baseIndex) / sortedSlots.length
    );

    // Set the time to the target slot using Temporal
    const baseZoned2 = fromDate(baseDate, "UTC");
    const dateWithSlot = baseZoned2.with({
      hour: targetSlot.hours,
      minute: targetSlot.minutes,
      second: 0,
      millisecond: 0,
    });
    const offsetZoned = addDays(dateWithSlot, daysToAdd);
    return toDate(offsetZoned);
  };

  const userTimezone = user?.timezone ?? "UTC";

  function toTemporalWeekday(dayOfWeek: number): number {
    return dayOfWeek === 0 ? 7 : dayOfWeek;
  }

  function findNextWeeklySlotDate(
    parsedSlots: Array<{ dayOfWeek: number; hours: number; minutes: number }>,
    afterDate: Date,
    tz: string
  ): Date | null {
    if (parsedSlots.length === 0) return null;
    const baseZoned = fromDate(afterDate, tz);
    const candidates: Date[] = [];
    for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
      const dateZoned = addDays(baseZoned, daysAhead);
      const year = dateZoned.year;
      const month = dateZoned.month;
      const day = dateZoned.day;
      const weekday = dateZoned.dayOfWeek;
      for (const slot of parsedSlots) {
        if (toTemporalWeekday(slot.dayOfWeek) !== weekday) continue;
        try {
          const slotZoned = createZonedDateTime(
            year,
            month,
            day,
            slot.hours,
            slot.minutes,
            tz
          );
          const slotDate = toDate(slotZoned);
          if (slotDate.getTime() > afterDate.getTime()) {
            candidates.push(slotDate);
          }
        } catch {
          // skip invalid slot
        }
      }
    }
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0] ?? null;
  }

  const calculateWeeklySlotsOffset = (
    baseDate: Date,
    baseIndex: number,
    weeklySlots: Array<{ dayOfWeek: number; time: string }>,
    tz: string
  ): Date => {
    const parsedSlots = weeklySlots
      .map((entry) => {
        const parts = String(entry.time).trim().split(":");
        const hours = parts[0] ? Number(parts[0]) : 0;
        const minutes = parts[1] ? Number(parts[1]) : 0;
        if (
          entry.dayOfWeek < 0 ||
          entry.dayOfWeek > 6 ||
          Number.isNaN(hours) ||
          Number.isNaN(minutes) ||
          hours < 0 ||
          hours > 23 ||
          minutes < 0 ||
          minutes > 59
        ) {
          return null;
        }
        return { dayOfWeek: entry.dayOfWeek, hours, minutes };
      })
      .filter(
        (s): s is { dayOfWeek: number; hours: number; minutes: number } =>
          s !== null
      );
    if (parsedSlots.length === 0) return baseDate;
    if (baseIndex === 0) return baseDate;
    let current = baseDate;
    let next: Date | null = null;
    for (let i = 0; i < baseIndex; i++) {
      next = findNextWeeklySlotDate(parsedSlots, current, tz);
      if (!next) return baseDate;
      current = new Date(next.getTime() + 1);
    }
    return next ?? baseDate;
  };

  const applyScheduleOffset = (
    baseDate: Date,
    baseIndex: number,
    queueType: QueueType
  ): Date => {
    if (baseIndex === 0) {
      return baseDate;
    }

    if (
      typeof queueType !== "object" ||
      !("scheduleType" in queueType) ||
      !queueType.scheduleType
    ) {
      return baseDate;
    }

    const config =
      typeof queueType === "object" && "scheduleConfig" in queueType
        ? queueType.scheduleConfig
        : null;

    if (queueType.scheduleType === "INTERVAL") {
      return calculateIntervalOffset(baseDate, baseIndex, config, user);
    }

    if (queueType.scheduleType === "WEEKLY_SLOTS") {
      const weeklySlots =
        config && isWeeklySlotsScheduleConfig(config) ? config.weeklySlots : [];
      return calculateWeeklySlotsOffset(
        baseDate,
        baseIndex,
        weeklySlots,
        userTimezone
      );
    }

    const slots =
      config && isFixedSlotsScheduleConfig(config) ? config.slots : [];
    return calculateFixedSlotsOffset(baseDate, baseIndex, slots);
  };

  const fetchScheduledTime = async (
    queueTypeName: string
  ): Promise<string | null> => {
    try {
      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeName,
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { scheduledTime?: unknown })
          : {};
      const scheduledTime =
        typeof data.scheduledTime === "string" ? data.scheduledTime : undefined;

      return scheduledTime ?? null;
    } catch (error) {
      const { handleErrorSafely } = await import("~/lib/error-handler.client");
      handleErrorSafely(error, {
        component: "DraftBulkResume",
        action: "fetchScheduledTime",
      });
      return null;
    }
  };

  const calculateQueueScheduleTime = async (
    queueTypeName: string,
    baseIndex = 0
  ): Promise<string> => {
    if (queueTypeName === "unassigned") {
      return "";
    }

    const scheduledTime = await fetchScheduledTime(queueTypeName);
    if (!scheduledTime) {
      return "";
    }

    // For bulk posts, add interval offset based on index
    if (baseIndex > 0) {
      const queueType = queueTypes.find((qt) => {
        const name = typeof qt === "string" ? qt : qt.name;
        return name === queueTypeName;
      });

      if (queueType && typeof queueType === "object") {
        // Parse scheduledTime and apply offset
        const userTimezone = user?.timezone ?? "UTC";
        const baseZoned = parseDateTimeLocal(scheduledTime, userTimezone);
        const baseDate = toDate(baseZoned);
        const offsetDate = applyScheduleOffset(baseDate, baseIndex, queueType);
        const offsetZoned = fromDate(offsetDate, userTimezone);
        return formatForDateTimeLocal(offsetZoned, userTimezone);
      }
    }

    return scheduledTime;
  };

  const handleQueueTypeChange = async (
    index: number,
    value: string | QueueType
  ) => {
    const updatedPosts = [...posts];
    const postToUpdate = updatedPosts[index];
    if (!postToUpdate) return;
    postToUpdate.queueType = value;

    // Auto-calculate schedule time if not unassigned
    const queueTypeName = typeof value === "string" ? value : value.name;
    if (queueTypeName !== "unassigned") {
      const scheduledTime = await calculateQueueScheduleTime(queueTypeName, 0);
      if (scheduledTime) {
        postToUpdate.scheduledFor = scheduledTime;
      }
    } else {
      postToUpdate.scheduledFor = "";
    }

    setPosts(updatedPosts);
  };

  const handleDateChange = (index: number, value: string) => {
    const updatedPosts = [...posts];
    const postToUpdate = updatedPosts[index];
    if (!postToUpdate) return;
    postToUpdate.scheduledFor = value;
    setPosts(updatedPosts);
  };

  const handleScheduleIntervalClick = (interval: number) => {
    if (posts.length === 0) return;

    const updatedPosts = [...posts];
    const firstPost = updatedPosts[0];
    if (!firstPost?.scheduledFor) return;
    const userTimezone = user?.timezone ?? "UTC";
    const baseZoned = parseDateTimeLocal(firstPost.scheduledFor, userTimezone);

    updatedPosts.forEach((post, index) => {
      const newZoned = addHours(baseZoned, index * interval);
      const scheduledFor = formatForDateTimeLocal(newZoned, userTimezone);

      post.scheduledFor = scheduledFor;
    });

    setPosts(updatedPosts);
  };

  const handleBulkQueueUpdate = async (queueType: QueueType | string) => {
    if (posts.length === 0) return;

    const updatedPosts = await Promise.all(
      posts.map(async (post, index) => {
        let scheduledFor = post.scheduledFor;

        // Auto-calculate schedule time if not unassigned
        const queueTypeName =
          typeof queueType === "string" ? queueType : queueType.name;
        if (queueTypeName !== "unassigned") {
          const calculatedTime = await calculateQueueScheduleTime(
            queueTypeName,
            index
          );
          if (calculatedTime) {
            scheduledFor = calculatedTime;
          }
        } else {
          scheduledFor = "";
        }

        return {
          ...post,
          queueType,
          scheduledFor,
        };
      })
    );

    setPosts(updatedPosts);
  };

  const handleSignAndResume = async () => {
    setIsSubmitting(true);
    setSigningError(null);
    try {
      // First, collect unique queue types and fetch hashtags in batch
      // This prevents making one API call per post, which can be very slow for bulk operations
      // Helper function to extract queue type name (handles both string and QueueType object)
      const getQueueTypeName = (qt: string | QueueType | undefined): string => {
        if (!qt) return "";
        return typeof qt === "string" ? qt : qt.name;
      };

      const uniqueQueueTypes = new Set(
        posts
          .map((post) => getQueueTypeName(post.queueType))
          .filter((qt) => qt && qt !== "unassigned")
      );

      // Fetch hashtags for all unique queue types in parallel
      const hashtagCache = new Map<string, string>();

      if (uniqueQueueTypes.size > 0) {
        const hashtagPromises = Array.from(uniqueQueueTypes).map(
          async (queueType) => {
            try {
              const response = await fetch("/api/effective-hashtags", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: user?.id,
                  queueTypeName: queueType,
                }),
              });
              const data = (await response.json()) as { hashtags?: string };
              return {
                queueType,
                hashtags: data.hashtags ?? "",
              };
            } catch (error) {
              const { handleErrorSafely } =
                await import("~/lib/error-handler.client");
              handleErrorSafely(error, {
                component: "DraftBulkResume",
                action: "getEffectiveHashtags",
              });
              return { queueType, hashtags: "" };
            }
          }
        );

        const hashtagResults = await Promise.all(hashtagPromises);
        hashtagResults.forEach(({ queueType, hashtags }) => {
          hashtagCache.set(queueType, hashtags);
        });
      }

      // Now create signed posts using cached hashtags
      const signedPosts = await Promise.all(
        posts.map(async (post) => {
          const userTimezone = user?.timezone ?? "UTC";

          // Use Temporal for timezone conversion
          const scheduledZoned = parseDateTimeLocal(
            post.scheduledFor,
            userTimezone
          );
          const utcZoned = scheduledZoned.withTimeZone("UTC");
          const scheduledForUnix = toUnixTimestamp(utcZoned);

          // Get effective hashtags from cache
          const queueTypeName = getQueueTypeName(post.queueType);
          const tagsString =
            queueTypeName && queueTypeName !== "unassigned"
              ? (hashtagCache.get(queueTypeName) ?? "")
              : "";

          const tagArray = tagsString
            .split(" ")
            .filter((tag) => tag.length > 0)
            .map((tag) => ["t", tag.replace("#", "")]);

          const contentToSign = user?.showHashTagsinPosts
            ? `${post.content ?? ""}\n${tagsString}`
            : (post.content ?? "");

          const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
            content: contentToSign,
            created_at: scheduledForUnix,
            kind: 1,
            tags: tagArray,
          });

          return {
            id: post.id,
            content: post.content,
            caption: post.caption,
            queueType: post.queueType,
            scheduledFor: scheduledForUnix.toString(),
            signedEvent: JSON.stringify(signedEvent),
            nostrEvent: JSON.stringify(nostrEvent),
          };
        })
      );

      const formData = new FormData();
      formData.append("_action", "bulkSignAndResume");
      signedPosts.forEach((post) => {
        formData.append("postIds", post.id);
        formData.append("contents", post.content ?? "");
        formData.append("captions", post.caption ?? "");
        const queueTypeValue =
          typeof post.queueType === "string"
            ? post.queueType
            : post.queueType.name;
        formData.append("queueTypes", queueTypeValue);
        formData.append("scheduledFors", post.scheduledFor);
        formData.append("signedEvents", post.signedEvent);
        formData.append("nostrEvents", post.nostrEvent);
      });

      fetcher.submit(formData, { method: "post", action: "/dashboard/drafts" });
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "DraftBulkResume",
          action: "signDrafts",
        }
      );
      setSigningError(
        error instanceof Error
          ? error.message
          : "Error signing drafts. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (_e) {
        return [];
      }
    }

    return fileUrl;
  };

  interface _FetcherData {
    success?: boolean;
  }

  useEffect(() => {
    const dataRaw = fetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { success?: unknown })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      onCancel(); // Close the modal and refresh
    }
  }, [fetcher.data, onCancel]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-3xl font-bold dark:text-white">
            Resume Draft Posts
          </h1>
          <p className="text-foreground dark:text-foreground mt-2">
            Configure and sign {posts.length} draft posts before scheduling
          </p>
        </div>

        {isSubmitting ? (
          <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground mx-auto mb-4 max-w-3xl rounded-md border bg-white/50 p-3 text-sm">
            Signing drafts… If you’re using a remote signer, keep it open to
            approve requests. If you started a new session in the signer app,
            the app will reconnect automatically in a few seconds.
          </div>
        ) : null}
        {signingError ? (
          <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive mx-auto mb-4 max-w-3xl rounded-md border p-3 text-sm">
            {signingError}
          </div>
        ) : null}

        {/* Schedule Interval Buttons */}
        {posts.length > 0 ? (
          <div className="mt-4 mb-4 flex justify-center">
            {scheduleIntervals
              ? scheduleIntervals.map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() =>
                      handleScheduleIntervalClick(
                        typeof interval === "string"
                          ? Number(interval)
                          : interval
                      )
                    }
                    disabled={isSubmitting}
                    className="dark:bg-card bg-muted text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-muted mx-2 rounded-md px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {formatIntervalLabel(
                      typeof interval === "string"
                        ? Number(interval)
                        : interval,
                      { compact: true }
                    )}
                  </button>
                ))
              : null}
          </div>
        ) : null}

        {/* Bulk Queue Selection */}
        {posts.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium">
              Bulk Queue Selection
            </h3>
            <div className="flex flex-wrap justify-center gap-2">
              {queueTypes
                .filter((q) => {
                  const name = typeof q === "string" ? q : q.name;
                  return name !== "Unassigned";
                })
                .map((queue) => {
                  const queueName =
                    typeof queue === "string" ? queue : queue.name;
                  const colorToken =
                    typeof queue === "object"
                      ? (queue as { colorToken?: string | null }).colorToken
                      : null;
                  const isAllSelected =
                    posts.length > 0 &&
                    posts.every((p) => p.queueType === queueName);
                  const accent =
                    colorToken != null
                      ? getQueueAccentHex(colorToken)
                      : undefined;
                  return (
                    <button
                      key={queueName}
                      type="button"
                      onClick={() =>
                        void handleBulkQueueUpdate(
                          isAllSelected ? "unassigned" : queueName
                        )
                      }
                      disabled={isSubmitting}
                      className={`rounded-md border-2 px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${getSelectedQueueStyle(colorToken ?? queueName, isAllSelected)}`}
                      style={{
                        backgroundColor: accent,
                        borderColor: accent,
                      }}
                      title={
                        isAllSelected
                          ? "Click again to leave all unassigned"
                          : "Assign this queue to all posts"
                      }
                    >
                      {queueName}
                    </button>
                  );
                })}
            </div>
            <p className="text-muted-foreground dark:text-foreground mt-2 text-center text-xs">
              Click a queue to assign; click again to leave all unassigned
            </p>
          </div>
        ) : null}

        {/* Posts Configuration Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left">Media</th>
                <th className="p-4 text-left">Content</th>
                <th className="p-4 text-left">Queue</th>
                <th className="p-4 text-left">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr key={post.id} className="border-b">
                  <td className="p-4">
                    {post.fileUrl.length > 0 ? (
                      <img
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Preview"
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : (
                      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-muted-foreground flex h-24 w-24 items-center justify-center rounded text-xs font-medium">
                        TEXT
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="max-h-20 overflow-y-auto">
                      <p className="text-muted-foreground dark:text-foreground text-sm">
                        {post.content?.substring(0, 150) ?? ""}
                        {(post.content?.length ?? 0) > 150 ? "..." : null}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {queueTypes
                        .filter((q) => {
                          const name = typeof q === "string" ? q : q.name;
                          return name !== "Unassigned";
                        })
                        .map((queue) => {
                          const queueName =
                            typeof queue === "string" ? queue : queue.name;
                          const colorToken =
                            typeof queue === "object"
                              ? (queue as { colorToken?: string | null })
                                  .colorToken
                              : null;
                          const isSelected = post.queueType === queueName;
                          const accent =
                            colorToken != null
                              ? getQueueAccentHex(colorToken)
                              : undefined;
                          return (
                            <button
                              key={queueName}
                              type="button"
                              onClick={() => {
                                void handleQueueTypeChange(
                                  index,
                                  isSelected ? "unassigned" : queueName
                                );
                              }}
                              disabled={isSubmitting}
                              className={`rounded-md border-2 px-3 py-1 text-xs font-medium transition-all duration-200 ${getSelectedQueueStyle(colorToken ?? queueName, isSelected)}`}
                              style={{
                                backgroundColor: accent,
                                borderColor: accent,
                              }}
                              title={
                                isSelected
                                  ? "Click again to leave unassigned"
                                  : undefined
                              }
                            >
                              {queueName}
                            </button>
                          );
                        })}
                    </div>
                  </td>
                  <td className="p-4">
                    <input
                      type="datetime-local"
                      value={post.scheduledFor}
                      onChange={(e) => handleDateChange(index, e.target.value)}
                      min={getNowForDateTimeLocal(user?.timezone ?? "UTC")}
                      disabled={isSubmitting}
                      className="dark:bg-card text-foreground dark:text-foreground rounded-lg border p-2"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="dark:bg-card border-border text-muted-foreground hover:bg-muted dark:border-border dark:text-foreground dark:hover:bg-muted rounded-lg border bg-white px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSignAndResume()}
            disabled={isSubmitting}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-300 disabled:to-green-400"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing & Scheduling...
              </span>
            ) : (
              `Sign & Schedule ${posts.length} Posts`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
