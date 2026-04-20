import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback, useRef } from "react";

import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { signDraftForScheduling } from "~/features/posts/drafts";
import {
  getClientDisplayErrorMessage,
  logClientError,
} from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { draftEditClientSchema } from "~/lib/validation/schemas/posts.client.schemas";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import {
  type UserData,
  type HashTagPreset,
  type PostData,
  type QueueType,
  type RepostConditions,
  defaultIncludeHashtagsForQueueSelection,
} from "../types";
import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
} from "../utils/delay-after-main";
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
  queueTypes: QueueType[];
}

/**
 * Custom hook for managing draft edit state and operations
 */
export function useDraftEditState({
  post,
  user,
  hashTagPresets,
  queueTypes,
}: UseDraftEditStateProps) {
  const fetcher = useFetcher();
  const currentUser = useOptionalUser();

  // Initialize form with React Hook Form
  const initialSelectedQueue =
    typeof post.queueType === "object" && post.queueType?.name
      ? post.queueType.name
      : typeof post.queueType === "string"
        ? post.queueType
        : "unassigned";

  const form = useZodForm(draftEditClientSchema, {
    defaultValues: {
      content: post.content ?? "",
      selectedQueue: initialSelectedQueue,
      scheduledFor: "",
      useHashtagPresets: !!post.hashTagPresetId,
      hashTagPresetId: post.hashTagPresetId ?? null,
      includeHashtagsInNoteBody: defaultIncludeHashtagsForQueueSelection(
        initialSelectedQueue,
        queueTypes
      ),
    },
  });

  // Watch form values
  const content = form.watch("content");
  const selectedQueue = form.watch("selectedQueue");
  const scheduledFor = form.watch("scheduledFor");
  const useHashtagPresets = form.watch("useHashtagPresets");
  const selectedHashtagPresetId = form.watch("hashTagPresetId");
  const includeHashtagsInNoteBody = form.watch("includeHashtagsInNoteBody");

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
  const [repostDelayList, setRepostDelayList] = useState<
    Array<{ id: string; value: number; unit: "hours" | "minutes" }>
  >(() => [{ id: crypto.randomUUID(), value: 2, unit: "hours" }]);
  const [repostConditions, setRepostConditions] =
    useState<RepostConditions | null>(null);
  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [quoteEntries, setQuoteEntries] = useState<
    Array<{
      id: string;
      value: number;
      unit: "hours" | "minutes";
      caption: string;
    }>
  >(() => [{ id: crypto.randomUUID(), value: 2, unit: "hours", caption: "" }]);

  const isSubmitting = fetcher.state !== "idle";

  // Tracks the in-flight signing attempt so the fetcher.data effect can
  // mark it completed/failed once the server response lands.
  const inFlightAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const attemptId = inFlightAttemptIdRef.current;
    if (!attemptId) return;
    const data = fetcher.data as { error?: unknown } | undefined;
    if (data?.error) {
      signingAttempts.markFailed(
        attemptId,
        getClientDisplayErrorMessage(data.error)
      );
    } else {
      signingAttempts.markCompleted(attemptId);
    }
    inFlightAttemptIdRef.current = null;
  }, [fetcher.state, fetcher.data]);

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
          isEnabled: currentUser.isEnabled,
        }
      : null;

    // Stable across resumes for the same intent: same draft post + same
    // target time => same dedupe slot. The user reopening the modal with
    // a different time is a fresh intent.
    const idempotencyKey = `draft_resume:${(post as { id?: string }).id ?? "draft"}:${scheduledFor ?? ""}`;

    const recoveryResult = await startRecoverableSign({
      intent: durableIntent("composer_publish", idempotencyKey, "Resume draft"),
      surface: `draft_resume:${(post as { id?: string }).id ?? "draft"}`,
      performSignAndSubmit: async (submissionId) => {
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
          scheduleRandomWindowMinutes: 0, // TODO: pass from queue default when draft edit has queue types
          includeHashtagsInNoteBody,
        });

        const formData = new FormData();
        formData.append("_action", "resume");
        formData.append("content", content);
        formData.append("caption", caption || content);
        formData.append("queueType", selectedQueue);
        formData.append("scheduledFor", result.scheduledForUnix.toString());
        formData.append("attemptId", submissionId);
        if (result.nominalScheduledForUnix != null) {
          formData.append(
            "nominalScheduledFor",
            result.nominalScheduledForUnix.toString()
          );
        }
        formData.append("signedEvent", JSON.stringify(result.signedEvent));
        formData.append("nostrEvent", JSON.stringify(result.nostrEvent));

        if (useHashtagPresets && selectedHashtagPresetId) {
          formData.append("hashTagPresetId", selectedHashtagPresetId);
          formData.append("useHashtagPresets", "on");
        }

        const mainSigned = result.signedEvent as {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          tags: string[][];
          content: string;
          sig: string;
        };

        const mainScheduledUnix = result.scheduledForUnix;
        if (alsoScheduleRepost && repostDelayList.length > 0) {
          const repostSchedules: Array<{
            scheduledFor: number;
            signedEvent: unknown;
          }> = [];
          for (const item of repostDelayList) {
            const delay = { value: item.value, unit: item.unit };
            if (!isValidDelayAfterMain(delay)) continue;
            const offsetSeconds = delayAfterMainToSeconds(delay);
            const repostScheduledForUnix = mainScheduledUnix + offsetSeconds;
            const repostEvent = buildKind6RepostEvent(
              mainSigned,
              repostScheduledForUnix
            );
            const { signedEvent: repostSignedEvent } =
              await nostrAdapter.signEvent(
                {
                  content: repostEvent.content,
                  created_at: repostEvent.created_at,
                  kind: repostEvent.kind,
                  tags: repostEvent.tags,
                },
                { clearCacheOnError: false }
              );
            repostSchedules.push({
              scheduledFor: repostScheduledForUnix,
              signedEvent: repostSignedEvent,
            });
          }
          if (repostSchedules.length > 0) {
            const withConditions =
              repostConditions && Object.keys(repostConditions).length > 0
                ? repostSchedules.map((s) => ({ ...s, ...repostConditions }))
                : repostSchedules;
            formData.append("repostSchedules", JSON.stringify(withConditions));
          }
        }

        if (alsoScheduleQuote && quoteEntries.length > 0) {
          const quoteSchedules: Array<{
            scheduledFor: number;
            signedEvent: unknown;
            caption?: string;
          }> = [];
          for (const entry of quoteEntries) {
            const delay = { value: entry.value, unit: entry.unit };
            if (!isValidDelayAfterMain(delay)) continue;
            const offsetSeconds = delayAfterMainToSeconds(delay);
            const quoteScheduledForUnix = mainScheduledUnix + offsetSeconds;
            const quoteEvent = buildQuoteEvent(
              mainSigned,
              entry.caption,
              quoteScheduledForUnix,
              []
            );
            const { signedEvent: quoteSignedEvent } =
              await nostrAdapter.signEvent(
                {
                  content: quoteEvent.content,
                  created_at: quoteEvent.created_at,
                  kind: quoteEvent.kind,
                  tags: quoteEvent.tags,
                },
                { clearCacheOnError: false }
              );
            quoteSchedules.push({
              scheduledFor: quoteScheduledForUnix,
              signedEvent: quoteSignedEvent,
              caption: entry.caption || undefined,
            });
          }
          if (quoteSchedules.length > 0) {
            formData.append("quoteSchedules", JSON.stringify(quoteSchedules));
          }
        }

        inFlightAttemptIdRef.current = submissionId;
        fetcher.submit(formData, { method: "post" });
        setShowResumeModal(false);
        // The fetcher.data effect promotes the attempt to `completed` /
        // `failed` once the server response settles.
      },
    });

    if (recoveryResult.ok) return;

    inFlightAttemptIdRef.current = null;
    if (recoveryResult.reason === "fatal") {
      logClientError(new Error(recoveryResult.lastError ?? "draft sign fail"), {
        component: "useDraftEditState",
        action: "signDraftForScheduling",
      });
      alert(
        recoveryResult.lastError ?? "Error signing the post. Please try again."
      );
    } else if (recoveryResult.reason === "expired") {
      alert("Recovery window expired before your signer reconnected.");
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

  useEffect(() => {
    form.setValue(
      "includeHashtagsInNoteBody",
      defaultIncludeHashtagsForQueueSelection(selectedQueue, queueTypes)
    );
  }, [selectedQueue, queueTypes, form]);

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
  const setIncludeHashtagsInNoteBody = (value: boolean) =>
    form.setValue("includeHashtagsInNoteBody", value);

  return {
    content,
    selectedQueue,
    scheduledFor,
    showResumeModal,
    useHashtagPresets,
    selectedHashtagPresetId,
    includeHashtagsInNoteBody,
    isSubmitting,
    fetcher,
    form, // Expose form for direct access if needed
    setContent,
    setSelectedQueue,
    setScheduledFor,
    setShowResumeModal,
    setUseHashtagPresets,
    setIncludeHashtagsInNoteBody,
    handleResumeClick,
    handleSignAndResume,
    handleHashtagPresetSelect,
    alsoScheduleRepost,
    setAlsoScheduleRepost,
    repostDelayList,
    setRepostDelayList,
    repostConditions,
    setRepostConditions,
    alsoScheduleQuote,
    setAlsoScheduleQuote,
    quoteEntries,
    setQuoteEntries,
  };
}
