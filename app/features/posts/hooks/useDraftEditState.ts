import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback, useRef } from "react";

import { logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { parseDateTimeLocal, toUnixTimestamp } from "~/lib/temporal";
import { draftEditClientSchema } from "~/lib/validation/schemas/posts.client.schemas";
import { useZodForm } from "~/lib/validation/utils.client";

import { signDraftForScheduling } from "../services/draft-sign.server";
import type { UserData, HashTagPreset, PostData } from "../types";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "../utils/repost-quote-events.client";

interface Post {
  content?: string | null;
  caption?: string | null;
  queueType?: { name: string } | null;
  hashTagPresetId?: string | null;
  fileUrl?: string[] | null;
}

interface UseDraftEditStateProps {
  post: Post;
  user: UserData;
  hashTagPresets: HashTagPreset[];
}

/**
 * Custom hook for managing draft edit state and operations
 */
export function useDraftEditState({
  post,
  user,
  hashTagPresets,
}: UseDraftEditStateProps) {
  const fetcher = useFetcher();
  const currentUser = useOptionalUser();

  // Initialize form with React Hook Form
  const form = useZodForm(draftEditClientSchema, {
    defaultValues: {
      content: post.content ?? "",
      selectedQueue:
        typeof post.queueType === "object" && post.queueType?.name
          ? post.queueType.name
          : typeof post.queueType === "string"
            ? post.queueType
            : "unassigned",
      scheduledFor: "",
      useHashtagPresets: !!post.hashTagPresetId,
      hashTagPresetId: post.hashTagPresetId ?? null,
    },
  });

  // Watch form values
  const content = form.watch("content");
  const selectedQueue = form.watch("selectedQueue");
  const scheduledFor = form.watch("scheduledFor");
  const useHashtagPresets = form.watch("useHashtagPresets");
  const selectedHashtagPresetId = form.watch("hashTagPresetId");

  // Use refs to stabilize dependencies for React compiler memoization
  const setScheduledForValueRef = useRef(
    form.setValue.bind(form, "scheduledFor")
  );
  const currentUserIdRef = useRef(currentUser?.id);
  useEffect(() => {
    setScheduledForValueRef.current = form.setValue.bind(form, "scheduledFor");
    currentUserIdRef.current = currentUser?.id;
  }, [form, currentUser?.id]);

  // Non-form state
  const [caption] = useState(post.caption ?? "");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [alsoScheduleRepost, setAlsoScheduleRepost] = useState(false);
  const [repostScheduledFor, setRepostScheduledFor] = useState("");
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [quoteScheduledFor, setQuoteScheduledFor] = useState("");
  const [quoteCaption, setQuoteCaption] = useState("");

  const isSubmitting = fetcher.state !== "idle";

  const handleResumeClick = () => {
    if (!scheduledFor) {
      alert("Please set a schedule time first");
      return;
    }
    setShowResumeModal(true);
  };

  const calculateQueueScheduleTime = useCallback(
    async (queueTypeName: string) => {
      if (queueTypeName === "unassigned") {
        setScheduledForValueRef.current("");
        return;
      }

      try {
        const response = await fetch("/api/queue-schedule", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueTypeName,
            userId: currentUserIdRef.current,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { scheduledTime?: string };
          const scheduledTime = data.scheduledTime;
          if (scheduledTime) {
            setScheduledForValueRef.current(scheduledTime);
          }
        }
      } catch (error) {
        logClientError(
          error instanceof Error ? error : new Error(String(error)),
          {
            component: "useDraftEditState",
            action: "calculateQueueScheduleTime",
            queueTypeName,
          }
        );
      }
    },
    []
  );

  const handleSignAndResume = async () => {
    try {
      // Convert currentUser (User | null | undefined) to UserData | null
      const currentUserData: UserData | null = currentUser
        ? {
            id: currentUser.id,
            npub: currentUser.npub,
            timezone: currentUser.timezone ?? null,
            scheduleInterval: currentUser.scheduleInterval
              .map(Number)
              .filter((n) => !isNaN(n)),
            userRelays: currentUser.userRelays,
            showHashTagsinPosts: currentUser.showHashTagsinPosts,
            isEnabled: currentUser.isEnabled,
          }
        : null;

      const result = await signDraftForScheduling({
        content,
        caption,
        scheduledFor: scheduledFor ?? "",
        selectedQueue,
        useHashtagPresets,
        selectedHashtags,
        user,
        currentUser: currentUserData,
        post: post as unknown as PostData,
      });

      const formData = new FormData();
      formData.append("_action", "resume");
      formData.append("content", content);
      formData.append("caption", caption || content);
      formData.append("queueType", selectedQueue);
      formData.append("scheduledFor", result.scheduledForUnix.toString());
      formData.append("signedEvent", JSON.stringify(result.signedEvent));
      formData.append("nostrEvent", JSON.stringify(result.nostrEvent));

      // Add hashtag preset data
      if (useHashtagPresets && selectedHashtagPresetId) {
        formData.append("hashTagPresetId", selectedHashtagPresetId);
        formData.append("useHashtagPresets", "on");
      }

      const userTimezone = user.timezone ?? "Etc/UTC";
      const mainSigned = result.signedEvent as {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
        sig: string;
      };

      if (alsoScheduleRepost && repostScheduledFor.trim()) {
        const zoned = parseDateTimeLocal(repostScheduledFor, userTimezone);
        const scheduledForUnix = toUnixTimestamp(zoned.withTimeZone("UTC"));
        const repostEvent = buildKind6RepostEvent(mainSigned, scheduledForUnix);
        const { signedEvent: repostSignedEvent } = await nostrAdapter.signEvent(
          {
            content: repostEvent.content,
            created_at: repostEvent.created_at,
            kind: repostEvent.kind,
            tags: repostEvent.tags,
          }
        );
        formData.append("alsoScheduleRepost", "on");
        formData.append("repostScheduledFor", scheduledForUnix.toString());
        formData.append("repostSignedEvent", JSON.stringify(repostSignedEvent));
      }

      if (alsoScheduleQuote && quoteScheduledFor.trim()) {
        const zoned = parseDateTimeLocal(quoteScheduledFor, userTimezone);
        const scheduledForUnix = toUnixTimestamp(zoned.withTimeZone("UTC"));
        const quoteEvent = buildQuoteEvent(
          mainSigned,
          quoteCaption,
          scheduledForUnix,
          []
        );
        const { signedEvent: quoteSignedEvent } = await nostrAdapter.signEvent({
          content: quoteEvent.content,
          created_at: quoteEvent.created_at,
          kind: quoteEvent.kind,
          tags: quoteEvent.tags,
        });
        formData.append("alsoScheduleQuote", "on");
        formData.append("quoteScheduledFor", scheduledForUnix.toString());
        formData.append("quoteSignedEvent", JSON.stringify(quoteSignedEvent));
        if (quoteCaption) {
          formData.append("quoteCaption", quoteCaption);
        }
      }

      fetcher.submit(formData, { method: "post" });
      setShowResumeModal(false);
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "useDraftEditState",
          action: "signDraftForScheduling",
        }
      );
      alert("Error signing the post. Please try again.");
    }
  };

  const handleHashtagPresetSelect = (presetId: string, hashtags: string) => {
    form.setValue("hashTagPresetId", presetId);
    form.setValue("useHashtagPresets", true);
    setSelectedHashtags(hashtags);
  };

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      void calculateQueueScheduleTime(selectedQueue);
    } else {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setScheduledForValueRef.current("");
      }, 0);
    }
  }, [selectedQueue, calculateQueueScheduleTime]);

  // Initialize hashtag preset data on component mount
  useEffect(() => {
    if (post.hashTagPresetId && hashTagPresets.length > 0) {
      const preset = hashTagPresets.find((p) => p.id === post.hashTagPresetId);
      if (preset) {
        // Defer to avoid cascading renders
        setTimeout(() => {
          setSelectedHashtags(preset.tags);
        }, 0);
      }
    }
  }, [post.hashTagPresetId, hashTagPresets]);

  // Provide setter wrappers for backward compatibility
  const setContent = (value: string) => form.setValue("content", value);
  const setSelectedQueue = (value: string) =>
    form.setValue("selectedQueue", value);
  const setScheduledFor = (value: string) =>
    form.setValue("scheduledFor", value);
  const setUseHashtagPresets = (value: boolean) =>
    form.setValue("useHashtagPresets", value);

  return {
    content,
    selectedQueue,
    scheduledFor,
    showResumeModal,
    useHashtagPresets,
    selectedHashtagPresetId,
    isSubmitting,
    fetcher,
    form, // Expose form for direct access if needed
    setContent,
    setSelectedQueue,
    setScheduledFor,
    setShowResumeModal,
    setUseHashtagPresets,
    handleResumeClick,
    handleSignAndResume,
    handleHashtagPresetSelect,
    alsoScheduleRepost,
    setAlsoScheduleRepost,
    repostScheduledFor,
    setRepostScheduledFor,
    alsoScheduleQuote,
    setAlsoScheduleQuote,
    quoteScheduledFor,
    setQuoteScheduledFor,
    quoteCaption,
    setQuoteCaption,
  };
}
