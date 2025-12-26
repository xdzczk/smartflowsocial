import { useEffect, useState, useRef } from "react";
import { type FetcherWithComponents } from "@remix-run/react";
import { nip19 } from "nostr-tools";
import { type BulkPost } from "~/features/posts/types";
import { type PreparedEvent } from "~/features/posts/types";
import { type ToastMessage } from "~/components/types";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import { type User } from "~/models/user.server";
import { logClientError } from "~/lib/error-handler.client";

interface UseBulkPostEventsProps {
    posts: BulkPost[];
    fetcher: FetcherWithComponents<any>;
    user: User | null;
    tags: string[];
    useHashtagPresets: boolean;
    selectedHashtags: string;
    setToast: (toast: ToastMessage | null) => void;
    setPreparedEvents: (events: PreparedEvent[]) => void;
    setShowConfirmation: (show: boolean) => void;
    setIsPreviewSubmitting: (isSubmitting: boolean) => void;
    setIsProcessing: (isProcessing: boolean) => void;
}

export function useBulkPostEvents({
    posts,
    fetcher,
    user,
    tags,
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setShowConfirmation,
    setIsPreviewSubmitting,
    setIsProcessing,
}: UseBulkPostEventsProps) {
    const isWaitingForUpload = useRef(false);

    // Validation function to check if all posts are ready for preview
    const validatePostsForPreview = () => {
        const errors: string[] = [];

        posts.forEach((post, index) => {
            // Check if schedule time is set
            if (!post.scheduledFor || post.scheduledFor.trim() === "") {
                errors.push(`Post ${index + 1}: Schedule time is required`);
            }

            // Check if schedule time is in the future
            if (post.scheduledFor) {
                const userTimezone = user?.timezone || "UTC";

                // The scheduledFor value is in user's timezone (from datetime-local input)
                // We need to compare it with current time in the same user timezone
                // Get current time in user's timezone as a comparable string
                const nowInUserTz = new Date().toLocaleString("en-US", {
                    timeZone: userTimezone,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5");

                // Compare as strings since both are in the same format (YYYY-MM-DDTHH:mm)
                // This avoids timezone conversion issues
                if (post.scheduledFor <= nowInUserTz) {
                    errors.push(`Post ${index + 1}: Schedule time must be in the future`);
                }
            }

            // Check if queue type is assigned (for new uploads)
            if (
                !post.isRepost &&
                !post.isKind6Repost &&
                !post.isQuotePost &&
                post.queueType === "unassigned"
            ) {
                errors.push(`Post ${index + 1}: Please assign a queue type`);
            }
        });

        return { isValid: errors.length === 0, errors };
    };

    const processEvents = async () => {
        // Create events with image URLs and hashtags
        const events = await Promise.all(
            posts.map(async (post, index) => {
                // Get effective hashtags - use manual selection if enabled, otherwise queue default
                let effectiveHashtags = "";

                if (useHashtagPresets && selectedHashtags) {
                    // Use manually selected hashtag preset
                    effectiveHashtags = selectedHashtags;
                } else {
                    // Use queue type's default hashtags
                    effectiveHashtags = await fetch("/api/effective-hashtags", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            userId: user?.id,
                            queueTypeName: post.queueType,
                        }),
                    })
                        .then((res) => res.json())
                        .then((data) => data.hashtags)
                        .catch(() => tags);
                }

                const tagsString = effectiveHashtags || "";
                const addTags = user?.showHashTagsinPosts ? `${tagsString}` : "";

                // Build content array, filtering out null/undefined/empty values
                const contentParts = [
                    fetcher.data.fileUrls[index].fileUrl,
                    post.caption,
                    addTags,
                ].filter((part) => part != null && part !== ""); // Filter out null, undefined, and empty strings

                const content = contentParts.join("\n");

                // Convert space-separated tags string into array of ["t", tag] pairs
                const tagArray = tagsString
                    .split(" ")
                    .filter((tag: string) => tag.length > 0)
                    .map((tag: string) => ["t", tag.replace("#", "")]);

                const userTimezone = user?.timezone || "UTC";
                const userTimezoneDateStr = fetcher.data.fileUrls[index].scheduledFor;
                let scheduledTime;

                // Only convert timezone if not UTC/Etc/GMT
                if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
                    const utcDate = new Date(userTimezoneDateStr);

                    // Get timezone offset in minutes between user timezone and UTC
                    const userDate = new Date(userTimezoneDateStr).toLocaleString(
                        "en-US",
                        {
                            timeZone: userTimezone,
                        },
                    );
                    const userOffset =
                        (new Date(userDate).getTime() - new Date(userTimezoneDateStr).getTime()) / 60000;

                    // Adjust the date by the offset
                    utcDate.setMinutes(utcDate.getMinutes() - userOffset);
                    scheduledTime = utcDate.getTime();
                } else {
                    // Parse date string and ensure it's in UTC
                    const dateObj = new Date(userTimezoneDateStr + "Z");
                    scheduledTime = dateObj.getTime();
                }

                // Handle kind 6 reposts differently
                if (post.isKind6Repost) {
                    // For kind 6 reposts, use the original file URL for display purposes
                    let displayFileUrl = "";
                    if (post.originalFileUrl && post.originalFileUrl.length > 0) {
                        // Handle case where fileUrl might be a JSON string array
                        if (
                            typeof post.originalFileUrl === "string" &&
                            post.originalFileUrl.startsWith("[")
                        ) {
                            try {
                                const parsed = JSON.parse(post.originalFileUrl);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    displayFileUrl = parsed[0];
                                }
                            } catch (e) {
                                // If parsing fails, use as is
                                displayFileUrl = post.originalFileUrl;
                            }
                        } else if (
                            Array.isArray(post.originalFileUrl) &&
                            post.originalFileUrl.length > 0
                        ) {
                            displayFileUrl = post.originalFileUrl[0];
                        } else {
                            displayFileUrl = post.originalFileUrl as string;
                        }
                    }

                    return {
                        fileUrl: displayFileUrl, // Use original file URL for display
                        scheduledFor: Math.floor(scheduledTime / 1000),
                        caption: "", // No caption for kind 6 reposts
                        queueType: post?.queueType || "unassigned",
                        isRecyclable: post?.isRecyclable || false,
                        originalPostId: post.originalPostId,
                        originalEventId: post.originalEventId,
                        originalEventPubkey: post.originalEventPubkey,
                        events: {
                            content: "", // Empty content for kind 6 reposts
                            created_at: Math.floor(scheduledTime / 1000),
                            kind: 6, // Kind 6 for reposts
                            tags: [
                                ["e", post.originalEventId, "wss://relay.primal.net"],
                                ["p", post.originalEventPubkey],
                            ],
                        },
                    };
                } else if (post.isQuotePost) {
                    // Handle quote posts (kind 1 with e and p tags)
                    let quoteContent;
                    let quoteTags;

                    if (post.isLongformQuote) {
                        // For longform quote posts, the caption already contains the naddr reference
                        // Don't add an additional nevent reference
                        quoteContent = [
                            post.caption, // This already contains nostr:naddr1... for longform
                            addTags.length > 10 ? "" : addTags, // Hide tags if longer than 10 characters
                        ]
                            .filter(Boolean)
                            .join("\n");

                        // For longform quotes, use 'a' tag instead of 'e' tag
                        // Extract dTag from naddr if available
                        let aTag = null;
                        if (post.naddr) {
                            try {
                                const decoded = nip19.decode(post.naddr.replace("nostr:", ""));
                                if (decoded.type === "naddr" && decoded.data) {
                                    const { identifier, pubkey, kind } = decoded.data;
                                    aTag = [
                                        "a",
                                        `${kind}:${pubkey}:${identifier}`,
                                        "wss://relay.primal.net",
                                        "mention",
                                    ];
                                }
                            } catch (e) {
                                logClientError(
                                    e instanceof Error ? e : new Error(String(e)),
                                    {
                                        component: "useBulkPostEvents",
                                        action: "decodeNaddr",
                                        message: "Failed to decode naddr for longform quote",
                                    },
                                    "warning",
                                );
                            }
                        }

                        quoteTags = [
                            ...tagArray, // Hashtag tags
                            ...(aTag ? [aTag] : []), // 'a' tag for longform reference if available
                            ["p", post.originalEventPubkey, "", "mention"], // Reference to quoted author
                        ];
                    } else {
                        // Create nevent1 format for regular quoted events
                        const neventEncoded = nip19.neventEncode({
                            id: post.originalEventId || "",
                            relays: ["wss://relay.primal.net"],
                            author: post.originalEventPubkey,
                        });

                        // For regular quote posts, content should include caption + nevent + hashtags
                        quoteContent = [
                            post.caption,
                            `nostr:${neventEncoded}`,
                            addTags.length > 10 ? "" : addTags, // Hide tags if longer than 10 characters
                        ]
                            .filter(Boolean)
                            .join("\n");

                        // Include hashtag t tags plus e and p tags for quote posts
                        quoteTags = [
                            ...tagArray, // Hashtag tags
                            ["e", post.originalEventId, "wss://relay.primal.net", "mention"], // Reference to quoted event
                            ["p", post.originalEventPubkey, "", "mention"], // Reference to quoted author
                        ];
                    }

                    return {
                        fileUrl: fetcher.data.fileUrls[index].fileUrl,
                        scheduledFor: Math.floor(scheduledTime / 1000),
                        caption: post?.caption || "",
                        queueType: post?.queueType || "unassigned",
                        isRecyclable: post?.isRecyclable || false,
                        originalPostId: post.originalPostId,
                        originalEventId: post.originalEventId,
                        originalEventPubkey: post.originalEventPubkey,
                        events: {
                            content: quoteContent,
                            created_at: Math.floor(scheduledTime / 1000),
                            kind: 1, // Kind 1 for quote posts
                            tags: quoteTags,
                            isQuotePost: true, // Flag to identify quote posts
                        },
                    };
                } else {
                    return {
                        fileUrl: fetcher.data.fileUrls[index].fileUrl,
                        scheduledFor: Math.floor(scheduledTime / 1000),
                        caption: post?.caption || "",
                        queueType: post?.queueType || "unassigned",
                        isRecyclable: post?.isRecyclable || false,
                        originalPostId: post?.originalPostId,
                        events: {
                            content,
                            created_at: Math.floor(scheduledTime / 1000),
                            kind: 1,
                            tags: tagArray,
                        },
                    };
                }
            }),
        );

        setPreparedEvents(events);
        setShowConfirmation(true);

        // Reset loading state when events are processed successfully
        setIsPreviewSubmitting(false);
    };

    const prepareEvents = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate posts before proceeding
        const { isValid, errors } = validatePostsForPreview();
        if (!isValid) {
            // Show toast notification with validation errors
            const errorMessage =
                errors.length === 1
                    ? errors[0]
                    : `${errors.length} issues found:\n• ${errors.slice(0, 3).join("\n• ")}${errors.length > 3 ? "\n• And more..." : ""}`;

            setToast({
                type: "error",
                message: errorMessage,
            });

            // Hide toast after 5 seconds
            setTimeout(() => setToast(null), 5000);
            return;
        }

        // Set loading state for preview submission
        setIsPreviewSubmitting(true);

        try {
            // Check if this is a repost with existing URLs, kind 6 repost, or quote post
            const hasRepostData = posts.some((post) => post.isRepost && post.fileUrl);
            const hasKind6RepostData = posts.some((post) => post.isKind6Repost);
            const hasQuotePostData = posts.some((post) => post.isQuotePost);

            if (hasRepostData || hasKind6RepostData || hasQuotePostData) {
                // For reposts and quote posts, create fake upload response with existing URLs
                const fakeFileUrls = posts.map((post) => {
                    let fileUrl = "";

                    if (post.isKind6Repost) {
                        // For kind 6 reposts, use the original file URL for display
                        if (post.originalFileUrl && post.originalFileUrl.length > 0) {
                            if (Array.isArray(post.originalFileUrl)) {
                                fileUrl = post.originalFileUrl[0];
                            } else if (
                                typeof post.originalFileUrl === "string" &&
                                post.originalFileUrl.startsWith("[")
                            ) {
                                try {
                                    const parsed = JSON.parse(post.originalFileUrl);
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                        fileUrl = parsed[0];
                                    }
                                } catch (_e) {
                                    // If parsing fails, use as is
                                    fileUrl = post.originalFileUrl;
                                }
                            } else {
                                fileUrl = post.originalFileUrl as string;
                            }
                        }
                    } else {
                        // For regular reposts and quote posts, use the fileUrl
                        fileUrl = Array.isArray(post.fileUrl)
                            ? post.fileUrl[0]
                            : post.fileUrl as string;
                    }

                    return {
                        fileUrl,
                        scheduledFor: post.scheduledFor,
                        queueType: post.queueType,
                        isRecyclable: post.isRecyclable || false,
                    };
                });

                // Simulate the fetcher response
                fetcher.data = { fileUrls: fakeFileUrls };

                // Trigger the event creation manually
                const customEvent = new CustomEvent("repostEventsPrepared");
                document.dispatchEvent(customEvent);
            } else {
                // Use client-side upload system
                const filesToUpload = posts
                    .map((post) => post.file)
                    .filter((file) => file !== null);

                if (filesToUpload.length > 0) {
                    try {
                        // Upload all files using the new upload system
                        // @ts-ignore
                        const uploadResults = await uploadMultipleFiles(filesToUpload);

                        // Check for failed uploads
                        const failedUploads = uploadResults.filter(
                            (result) => !result.success,
                        );
                        if (failedUploads.length > 0) {
                            const errorMessages = failedUploads
                                .map((result) => result.error)
                                .join(", ");
                            throw new Error(`Upload failed: ${errorMessages}`);
                        }

                        // Map upload results back to posts (maintaining order)
                        let uploadIndex = 0;
                        const mappedResults = posts.map((post) => {
                            if (post.file) {
                                return uploadResults[uploadIndex++];
                            }
                            return { success: true, file: { url: "" } }; // Placeholder for posts without files
                        });

                        // Send results to server
                        const formData = new FormData();
                        formData.append("uploadResults", JSON.stringify(mappedResults));
                        posts.forEach((post) => {
                            formData.append("scheduledDates", post.scheduledFor);
                            formData.append("queueTypes", post.queueType);
                            formData.append("isRecyclable", (post.isRecyclable || false).toString());
                        });
                        formData.append("_action", "_upload_images_preview");

                        // Submit to server for processing
                        isWaitingForUpload.current = true;
                        fetcher.submit(formData, {
                            method: "post",
                        });
                    } catch (error: unknown) {
                        const { handleAsyncErrorWithMessage, getErrorMessage } = await import("~/lib/error-handler.client");
                        const errorMessage = `Upload failed: ${getErrorMessage(error)}`;
                        handleAsyncErrorWithMessage(
                            error,
                            errorMessage,
                            {
                                component: "useBulkPostEvents",
                                action: "prepareEvents",
                            },
                            false, // Don't show toast, we set toast state instead
                        );
                        setToast({
                            type: "error",
                            message: errorMessage,
                        });
                        setTimeout(() => setToast(null), 5000);
                        setIsPreviewSubmitting(false);
                        return;
                    }
                } else {
                    // No files to upload, just proceed with existing URLs (for reposts/quotes)
                    const formData = new FormData();
                    formData.append("uploadResults", JSON.stringify([])); // Empty results for no uploads
                    posts.forEach((post) => {
                        formData.append("scheduledDates", post.scheduledFor);
                        formData.append("queueTypes", post.queueType);
                        formData.append("isRecyclable", (post.isRecyclable || false).toString());
                    });
                    formData.append("_action", "_upload_images_preview");

                    // Submit to server for processing
                    isWaitingForUpload.current = true;
                    fetcher.submit(formData, {
                        method: "post",
                    });
                }
            }
        } catch (error: unknown) {
            const { handleAsyncErrorWithMessage } = await import("~/lib/error-handler.client");
            handleAsyncErrorWithMessage(
                error,
                "An error occurred while preparing posts. Please try again.",
                {
                    component: "useBulkPostEvents",
                    action: "prepareEvents",
                },
                false, // Don't show toast, we set toast state instead
            );
            setToast({
                type: "error",
                message: "An error occurred while preparing posts. Please try again.",
            });

            // Hide toast after 5 seconds
            setTimeout(() => setToast(null), 5000);
            setIsPreviewSubmitting(false);
        }
    };

    // Add event listener for repost events
    useEffect(() => {
        const handleRepostEventsPrepared = async () => {
            // Manually trigger the event creation logic
            if (fetcher.data?.fileUrls) {
                await processEvents();
            }
        };

        document.addEventListener(
            "repostEventsPrepared",
            handleRepostEventsPrepared,
        );

        return () => {
            document.removeEventListener(
                "repostEventsPrepared",
                handleRepostEventsPrepared,
            );
        };
    }, [fetcher.data, posts, tags, user?.npub]);

    // Watch for upload completion
    useEffect(() => {
        if (
            isWaitingForUpload.current &&
            fetcher.state === "idle" &&
            fetcher.data?.fileUrls
        ) {
            isWaitingForUpload.current = false;
            processEvents();
        }
    }, [fetcher.state, fetcher.data]);

    return { prepareEvents };
}
