/**
 * State and handlers for the draft bulk resume flow.
 * Extracted from DraftBulkResume to keep the component under 400 LOC.
 */

import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import type { QueueType, PostData } from "~/features/posts/types";
import { logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

import {
  applyOffsetAndFormat,
  fetchScheduledTime,
} from "../utils/draft-bulk-resume.utils";

export interface DraftBulkResumePost {
  id: string;
  content: string | undefined;
  caption: string | undefined;
  fileUrl: string[];
  postType?: string;
  queueType: string | QueueType;
  scheduledFor: string;
}

export interface UseDraftBulkResumeStateProps {
  selectedDrafts: PostData[];
  queueTypes: QueueType[];
  onCancel: () => void;
}

export function useDraftBulkResumeState({
  selectedDrafts,
  queueTypes,
  onCancel,
}: UseDraftBulkResumeStateProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  const scheduleIntervals =
    user && typeof user === "object" && "scheduleInterval" in user
      ? user.scheduleInterval
      : null;

  const [posts, setPosts] = useState<DraftBulkResumePost[]>(() =>
    selectedDrafts.map((draft, index): DraftBulkResumePost => {
      const userTimezone = user?.timezone ?? "UTC";
      const now = nowInTimezone(userTimezone);
      const hoursToAdd = index * (Number(scheduleIntervals?.[0]) || 2);
      const scheduledZoned = addHours(now, hoursToAdd);
      const scheduledFor = formatForDateTimeLocal(scheduledZoned, userTimezone);
      const queueType =
        draft.queueType?.name ?? draft.queueType ?? "unassigned";
      return {
        id: draft.id,
        content: draft.content ?? draft.caption ?? undefined,
        caption: draft.caption ?? undefined,
        /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- draft.fileUrl may be missing in partial types */
        fileUrl: draft.fileUrl ?? [],
        postType: draft.postType,
        queueType,
        scheduledFor,
      };
    })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const pendingRetryRef = useRef<(() => void) | null>(null);

  const clearSigningState = () => {
    setIsSubmitting(false);
    setSigningError(null);
  };
  const retryLastSign = () => {
    const fn = pendingRetryRef.current;
    pendingRetryRef.current = null;
    fn?.();
  };

  useEffect(() => {
    const dataRaw = fetcher.data;
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { success?: unknown })
        : null;
    if (data && typeof data.success === "boolean" && data.success) {
      onCancel();
    }
  }, [fetcher.data, onCancel]);

  const resolveQueueTypeId = (queueTypeName: string): string | null => {
    if (queueTypeName === "unassigned") return null;
    const qt = queueTypes.find((q) => {
      const name = typeof q === "string" ? q : q.name;
      return name === queueTypeName;
    });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- qt from find() may be undefined
    return typeof qt === "object" && qt && "id" in qt
      ? (qt as { id: string }).id
      : null;
  };

  const calculateQueueScheduleTime = async (
    queueTypeName: string,
    baseIndex = 0
  ): Promise<string> => {
    const queueTypeId = resolveQueueTypeId(queueTypeName);
    if (!queueTypeId) return "";
    const scheduledTime = await fetchScheduledTime(queueTypeId, user?.id);
    if (!scheduledTime) return "";
    if (baseIndex > 0) {
      const queueType = queueTypes.find((qt) => {
        const name = typeof qt === "string" ? qt : qt.name;
        return name === queueTypeName;
      });
      if (queueType && typeof queueType === "object") {
        return applyOffsetAndFormat(
          scheduledTime,
          baseIndex,
          queueType,
          user ?? null
        );
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
    const queueTypeName = typeof value === "string" ? value : value.name;
    if (queueTypeName !== "unassigned") {
      const scheduledTime = await calculateQueueScheduleTime(queueTypeName, 0);
      if (scheduledTime) postToUpdate.scheduledFor = scheduledTime;
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
      post.scheduledFor = formatForDateTimeLocal(newZoned, userTimezone);
    });
    setPosts(updatedPosts);
  };

  const handleBulkQueueUpdate = async (queueType: QueueType | string) => {
    if (posts.length === 0) return;
    const updatedPosts = await Promise.all(
      posts.map(async (post, index) => {
        let scheduledFor = post.scheduledFor;
        const queueTypeName =
          typeof queueType === "string" ? queueType : queueType.name;
        if (queueTypeName !== "unassigned") {
          const calculatedTime = await calculateQueueScheduleTime(
            queueTypeName,
            index
          );
          if (calculatedTime) scheduledFor = calculatedTime;
        } else {
          scheduledFor = "";
        }
        return { ...post, queueType, scheduledFor };
      })
    );
    setPosts(updatedPosts);
  };

  const getQueueTypeName = (qt: string | QueueType | undefined): string => {
    if (!qt) return "";
    return typeof qt === "string" ? qt : qt.name;
  };

  const handleSignAndResume = async () => {
    setIsSubmitting(true);
    setSigningError(null);
    pendingRetryRef.current = () => void handleSignAndResume();
    try {
      const uniqueQueueTypes = new Set(
        posts
          .map((p) => getQueueTypeName(p.queueType))
          .filter((qt) => qt && qt !== "unassigned")
      );
      const hashtagCache = new Map<string, string>();
      if (uniqueQueueTypes.size > 0) {
        const hashtagPromises = Array.from(uniqueQueueTypes).map(
          async (queueType) => {
            try {
              const response = await fetch("/api/effective-hashtags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user?.id,
                  queueTypeName: queueType,
                }),
              });
              const data = (await response.json()) as { hashtags?: string };
              return { queueType, hashtags: data.hashtags ?? "" };
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
        const results = await Promise.all(hashtagPromises);
        results.forEach(({ queueType, hashtags }) =>
          hashtagCache.set(queueType, hashtags)
        );
      }

      // Sign sequentially to avoid flooding remote signers with concurrent requests
      const signedPosts: Array<{
        id: string;
        content: string | undefined;
        caption: string | undefined;
        queueType: string | QueueType;
        scheduledFor: string;
        signedEvent: string;
        nostrEvent: string;
      }> = [];
      for (const post of posts) {
        const userTimezone = user?.timezone ?? "UTC";
        const scheduledZoned = parseDateTimeLocal(
          post.scheduledFor,
          userTimezone
        );
        const utcZoned = scheduledZoned.withTimeZone("UTC");
        const scheduledForUnix = toUnixTimestamp(utcZoned);
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
        const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
          {
            content: contentToSign,
            created_at: scheduledForUnix,
            kind: 1,
            tags: tagArray,
          },
          { clearCacheOnError: false }
        );
        signedPosts.push({
          id: post.id,
          content: post.content ?? undefined,
          caption: post.caption ?? undefined,
          queueType: post.queueType,
          scheduledFor: scheduledForUnix.toString(),
          signedEvent: JSON.stringify(signedEvent),
          nostrEvent: JSON.stringify(nostrEvent),
        });
      }

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
      pendingRetryRef.current = null;
      fetcher.submit(formData, { method: "post", action: "/dashboard/drafts" });
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        { component: "DraftBulkResume", action: "signDrafts" }
      );
      setSigningError(
        error instanceof Error
          ? error.message
          : "Error signing drafts. Please try again."
      );
      pendingRetryRef.current = null;
      setIsSubmitting(false);
    }
  };

  return {
    posts,
    setPosts,
    isSubmitting,
    signingError,
    pendingRetryRef,
    handlers: {
      clearSigningState,
      retryLastSign,
      handleQueueTypeChange,
      handleDateChange,
      handleScheduleIntervalClick,
      handleBulkQueueUpdate,
      handleSignAndResume,
    },
    user,
    scheduleIntervals,
    fetcher,
  };
}
