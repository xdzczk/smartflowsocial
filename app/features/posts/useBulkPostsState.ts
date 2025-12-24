import { useEffect } from "react";
import { type BulkPost } from "~/features/posts/components/BulkPostCard";
import { handleErrorSafely } from "~/lib/error-handler.client";

interface UseBulkPostsStateProps {
    mode: string | null;
    posts: BulkPost[];
    setPosts: (posts: BulkPost[]) => void;
}

export function useBulkPostsState({ mode, posts, setPosts }: UseBulkPostsStateProps) {
    // Load repost data from sessionStorage if in recycle mode
    useEffect(() => {
        if (mode === "recycle") {
            const repostData = sessionStorage.getItem("repostData");
            if (repostData) {
                try {
                    const parsedData = JSON.parse(repostData);

                    // Convert repost data to posts format with file objects from URLs
                    const repostPosts = parsedData.map((item: any) => {
                        let fileUrl = item.fileUrl;

                        // Handle case where fileUrl might be a JSON string array
                        if (typeof fileUrl === "string") {
                            try {
                                const parsed = JSON.parse(fileUrl);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    fileUrl = parsed[0]; // Take first URL from array
                                }
                            } catch (e) {
                                // If it's not JSON, keep as is
                            }
                        } else if (Array.isArray(fileUrl) && fileUrl.length > 0) {
                            fileUrl = fileUrl[0]; // Take first URL from array
                        }

                        return {
                            file: null, // We'll handle URL-based files differently
                            caption: item.caption,
                            queueType: item.queueType,
                            scheduledFor: item.scheduledFor,
                            fileUrl: fileUrl, // Ensured to be a single URL string
                            isRepost: true, // Flag to indicate this is a repost
                            isRecyclable: item.isRecyclable || false,
                            originalPostId: item.originalPostId, // Include original post ID for tracking
                        };
                    });

                    setPosts(repostPosts);

                    // Clear sessionStorage after loading
                    sessionStorage.removeItem("repostData");
                } catch (error) {
                    handleErrorSafely(error, {
                        component: "useBulkPostsState",
                        action: "loadRepostData",
                    });
                }
            }
        } else if (mode === "repost") {
            // Load scheduled repost data for kind 6 reposts
            const scheduledRepostData = sessionStorage.getItem("scheduledRepostData");
            if (scheduledRepostData) {
                try {
                    const parsedData = JSON.parse(scheduledRepostData);

                    // We need to fetch the original posts to get their images
                    const fetchOriginalPosts = async () => {
                        try {
                            const response = await fetch("/api/posts/batch", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    postIds: parsedData.map((item: any) => item.originalPostId),
                                }),
                            });

                            if (response.ok) {
                                const originalPosts = await response.json();
                                return originalPosts;
                            }
                        } catch (error) {
                            handleErrorSafely(error, {
                                component: "useBulkPostsState",
                                action: "fetchOriginalPosts",
                            });
                        }
                        return [];
                    };

                    // Fetch original posts and merge with repost data
                    fetchOriginalPosts().then((originalPosts) => {
                        const repostPosts = parsedData.map((item: any) => {
                            const originalPost = originalPosts.find(
                                (p: any) => p.id === item.originalPostId,
                            );

                            return {
                                file: null, // No file for kind 6 reposts
                                caption: item.caption, // Empty for kind 6
                                queueType: item.queueType,
                                scheduledFor: item.scheduledFor,
                                fileUrl: originalPost?.fileUrl || [], // Use original post's images for display
                                originalFileUrl: originalPost?.fileUrl || [], // Keep original file URLs for display
                                isKind6Repost: true, // Flag to indicate this is a kind 6 repost
                                originalPostId: item.originalPostId,
                                originalEventId: item.originalEventId,
                                originalEventPubkey: item.originalEventPubkey,
                                originalCaption: originalPost?.caption || "", // Store original caption for context
                                isRecyclable: item.isRecyclable || false,
                            };
                        });

                        setPosts(repostPosts);
                    });

                    // Clear sessionStorage after loading
                    sessionStorage.removeItem("scheduledRepostData");
                } catch (error) {
                    handleErrorSafely(error, {
                        component: "useBulkPostsState",
                        action: "loadScheduledRepostData",
                    });
                }
            }
        } else if (mode === "quote") {
            // Load quote post data
            const quotePostData = sessionStorage.getItem("quotePostData");
            if (quotePostData) {
                try {
                    const parsedData = JSON.parse(quotePostData);

                    // Convert quote post data to posts format
                    const quotePosts = parsedData.map((item: any) => {
                        let fileUrl = item.fileUrl;

                        // Handle case where fileUrl might be a JSON string array
                        if (typeof fileUrl === "string") {
                            try {
                                const parsed = JSON.parse(fileUrl);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    fileUrl = parsed[0]; // Take first URL from array
                                }
                            } catch (e) {
                                // If it's not JSON, keep as is
                            }
                        } else if (Array.isArray(fileUrl) && fileUrl.length > 0) {
                            fileUrl = fileUrl[0]; // Take first URL from array
                        }

                        return {
                            file: null, // We'll handle URL-based files differently
                            caption: item.caption || "", // Start with empty caption for user to add content
                            queueType: item.queueType,
                            scheduledFor: item.scheduledFor,
                            fileUrl: fileUrl, // Ensured to be a single URL string
                            isQuotePost: true, // Flag to indicate this is a quote post
                            isLongformQuote: item.isLongformQuote || false, // Preserve longform quote flag
                            naddr: item.naddr || "", // Preserve naddr for longform quotes
                            originalPostId: item.originalPostId,
                            originalEventId: item.originalEventId,
                            originalEventPubkey: item.originalEventPubkey,
                            originalCaption: item.originalCaption || "",
                            originalTitle: item.originalTitle || "", // Preserve original title for longform
                            isRecyclable: item.isRecyclable || false,
                        };
                    });

                    setPosts(quotePosts);

                    // Clear sessionStorage after loading
                    sessionStorage.removeItem("quotePostData");
                } catch (error) {
                    handleErrorSafely(error, {
                        component: "useBulkPostsState",
                        action: "loadQuotePostData",
                    });
                }
            }
        }
    }, [mode, setPosts]);
}
