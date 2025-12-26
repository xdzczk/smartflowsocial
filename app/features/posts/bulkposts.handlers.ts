/**
 * Handler functions for Bulk Posts feature
 * Extracted from dashboard.bulkposts.tsx
 */
import {
    type BulkPost,
    type QueueType,
    type BulkPostsHandlerDeps,
    type ScheduleConfig,
    isIntervalScheduleConfig,
    isFixedSlotsScheduleConfig,
} from "~/features/posts/types";
import { resizeImage } from "~/features/upload/image-resize";
import { isVideoFile } from "~/utils/media-helpers";

// Re-export types for consumers
export type { QueueType, BulkPostsHandlerDeps } from "~/features/posts/types";

/**
 * Handle file selection and processing for bulk uploads
 */
export async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    deps: Pick<BulkPostsHandlerDeps, 'posts' | 'setPosts' | 'user' | 'scheduleIntervals' | 'setIsProcessing' | 'setProcessingProgress' | 'setFirstItemTimeManuallyChanged'>
): Promise<void> {
    const { posts, setPosts, user, scheduleIntervals, setIsProcessing, setProcessingProgress, setFirstItemTimeManuallyChanged } = deps;
    const selectedFiles = Array.from(e.target.files || []);

    // Check total size - different limits for images and videos
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
        alert("Total file size exceeds 100MB. Please select smaller files.");
        return;
    }

    // Check individual file size limits
    for (const file of selectedFiles) {
        const isVideo = isVideoFile(file);
        if (isVideo && file.size > MAX_VIDEO_SIZE) {
            alert(`Video file ${file.name} exceeds 100MB limit. Please select a smaller file.`);
            return;
        } else if (!isVideo && file.size > MAX_IMAGE_SIZE) {
            alert(`Image file ${file.name} exceeds 10MB limit. Please select a smaller file.`);
            return;
        }
    }

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: selectedFiles.length });

    // Process files in chunks to prevent memory overload
    const CHUNK_SIZE = 10;
    const processedFiles: File[] = [];

    try {
        for (let i = 0; i < selectedFiles.length; i += CHUNK_SIZE) {
            const chunk = selectedFiles.slice(i, i + CHUNK_SIZE);
            const chunkProcessed = await Promise.all(
                chunk.map(async (file) => {
                    // For image files, resize and process. For video files, use as is.
                    if (isVideoFile(file)) {
                        return file; // Return video files as-is
                    } else {
                        // Process image files - resize and remove metadata
                        const resized = await resizeImage(file);
                        return resized;
                    }
                }),
            );
            processedFiles.push(...chunkProcessed);

            // Update progress
            setProcessingProgress({
                current: i + chunk.length,
                total: selectedFiles.length,
            });

            // Allow browser to breathe between chunks
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.error("Error processing media files:", error);
        alert("Error processing media files. Please try again.");
        setIsProcessing(false);
        return;
    }

    const newPosts = processedFiles.map((file, index) => {
        // Get current date in user's timezone
        const now = new Date();
        const userTimezone = user?.timezone;

        const localDate = new Date(
            now.toLocaleString("en-US", { timeZone: userTimezone }),
        );

        // Add index+4 hours to schedule 4 post per hour (default)
        localDate.setHours(
            localDate.getHours() + (index + Number(scheduleIntervals?.[0] || 4)),
        );

        return {
            file,
            caption: "",
            queueType: "unassigned",
            isRecyclable: false,
            scheduledFor: localDate
                .toLocaleString("en-US", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                })
                .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
        };
    });

    setPosts([...posts, ...newPosts]);
    setIsProcessing(false);
    // Reset flag when new files are uploaded
    setFirstItemTimeManuallyChanged(false);
}

/**
 * Handle caption change for a post
 */
export function handleCaptionChange(
    index: number,
    value: string,
    posts: BulkPost[],
    setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>
): void {
    const updatedPosts = [...posts];
    updatedPosts[index].caption = value;
    setPosts(updatedPosts);
}

/**
 * Handle date/time change for a post
 */
export function handleDateChange(
    index: number,
    value: string,
    posts: BulkPost[],
    setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
    setFirstItemTimeManuallyChanged: (changed: boolean) => void
): void {
    const updatedPosts = [...posts];

    // Handle empty string
    if (!value || value.trim() === "") {
        updatedPosts[index].scheduledFor = "";
        setPosts(updatedPosts);
        return;
    }

    // Parse the input value
    const localDate = new Date(value);
    
    // Check if date is invalid
    if (isNaN(localDate.getTime())) {
        updatedPosts[index].scheduledFor = "";
        setPosts(updatedPosts);
        return;
    }
    
    const hours = localDate.getHours();

    // Create a new date string maintaining the hours exactly as input
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    const minutes = String(localDate.getMinutes()).padStart(2, "0");

    // Format the date string manually to ensure hour isn't converted
    const formattedDate = `${year}-${month}-${day}T${String(hours).padStart(2, "0")}:${minutes}`;

    updatedPosts[index].scheduledFor = formattedDate;

    // Set flag if user manually changed the first item's time
    if (index === 0) {
        setFirstItemTimeManuallyChanged(true);
    }

    setPosts(updatedPosts);
}

/**
 * Handle recyclable checkbox change for a post
 */
export function handleIsRecyclableChange(
    index: number,
    checked: boolean,
    posts: BulkPost[],
    setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>
): void {
    const updatedPosts = [...posts];
    updatedPosts[index].isRecyclable = checked;
    setPosts(updatedPosts);
}

/**
 * Toggle all posts' recyclable status
 */
export function handleBulkRecyclableToggle(
    posts: BulkPost[],
    setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>
): void {
    if (posts.length === 0) return;

    // Check if all posts are currently recyclable
    const allRecyclable = posts.every((post) => post.isRecyclable);

    // Toggle all posts to the opposite state
    const updatedPosts = posts.map((post) => ({
        ...post,
        isRecyclable: !allRecyclable,
    }));

    setPosts(updatedPosts);
}

/**
 * Remove a post at the given index
 */
export function handleRemovePost(
    index: number,
    posts: BulkPost[],
    setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>
): void {
    setPosts(posts.filter((_, i) => i !== index));
}

/**
 * Apply schedule interval to all posts
 */
export function handleScheduleIntervalClick(
    interval: number,
    posts: BulkPost[],
    setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>,
    firstItemTimeManuallyChanged: boolean
): void {
    if (posts.length === 0) return;

    const updatedPosts = [...posts];

    let baseDate: Date;

    // If first item time was manually changed, use it as base
    if (firstItemTimeManuallyChanged && updatedPosts[0].scheduledFor) {
        baseDate = new Date(updatedPosts[0].scheduledFor);
    } else {
        // Original behavior - use first post's scheduled time or current time
        const firstPost = updatedPosts[0];
        baseDate = firstPost.scheduledFor
            ? new Date(firstPost.scheduledFor)
            : new Date();
    }

    // Update each post's scheduled time based on the interval
    updatedPosts.forEach((post, index) => {
        const newDate = new Date(baseDate);
        newDate.setHours(baseDate.getHours() + index * interval);

        // Format the date string
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, "0");
        const day = String(newDate.getDate()).padStart(2, "0");
        const hours = String(newDate.getHours()).padStart(2, "0");
        const minutes = String(newDate.getMinutes()).padStart(2, "0");

        post.scheduledFor = `${year}-${month}-${day}T${hours}:${minutes}`;
    });

    setPosts(updatedPosts);
}

/**
 * Update displayed hashtags based on queue type
 */
export async function updateDisplayedHashtags(
    queueTypeName: string,
    queueTypes: QueueType[],
    tags: string[],
    setSelectedQueueType: (type: string) => void,
    setDisplayedHashtags: (hashtags: string | string[]) => void
): Promise<void> {
    setSelectedQueueType(queueTypeName);

    if (queueTypeName === "unassigned") {
        setDisplayedHashtags(tags);
        return;
    }

    // Find the queue type object to get its ID
    const selectedQueueType = queueTypes.find(qt =>
        (typeof qt === "string" ? qt : qt.name) === queueTypeName
    );
    const queueTypeId = typeof selectedQueueType === "object" ? selectedQueueType.id : null;

    try {
        const response = await fetch("/api/effective-hashtags", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                queueTypeId,
                queueTypeName: queueTypeName, // Keep for backward compatibility
            }),
        });

        if (response.ok) {
            const data = await response.json();
            setDisplayedHashtags(data.hashtags || tags);
        } else {
            setDisplayedHashtags(tags);
        }
    } catch (error) {
        console.error("Error fetching effective hashtags:", error);
        setDisplayedHashtags(tags);
    }
}

/**
 * Handle queue type change for a single post
 */
export async function handleQueueTypeChange(
    index: number,
    value: string,
    deps: Pick<BulkPostsHandlerDeps, 'posts' | 'setPosts' | 'queueTypes' | 'tags' | 'user' | 'setDisplayedHashtags' | 'setSelectedQueueType'>
): Promise<void> {
    const { posts, setPosts, queueTypes, tags, user, setDisplayedHashtags, setSelectedQueueType } = deps;
    const updatedPosts = [...posts];
    updatedPosts[index].queueType = value;

    // Find the queue type object to get its ID
    const selectedQueueType = queueTypes.find(qt =>
        (typeof qt === "string" ? qt : qt.name) === value
    );
    const queueTypeId = typeof selectedQueueType === "object" ? selectedQueueType.id : null;

    // Auto-calculate schedule time if not unassigned
    if (value !== "unassigned" && queueTypeId) {
        try {
            const requestBody = {
                queueTypeId,
                queueTypeName: value, // Keep for backward compatibility
                userId: user?.id,
            };

            const response = await fetch("/api/queue-schedule", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                const responseData = await response.json();
                const { scheduledTime } = responseData;
                if (scheduledTime) {
                    updatedPosts[index].scheduledFor = scheduledTime;
                }
            }
        } catch (error) {
            console.error("Error calculating schedule time:", error);
        }
    } else {
        updatedPosts[index].scheduledFor = "";
    }

    setPosts(updatedPosts);

    // Update displayed hashtags if this is the predominant queue type
    const queueTypeCounts: Record<string, number> = {};
    updatedPosts.forEach((post) => {
        queueTypeCounts[post.queueType] =
            (queueTypeCounts[post.queueType] || 0) + 1;
    });

    const mostUsedQueueType = Object.keys(queueTypeCounts).reduce(
        (a, b) => (queueTypeCounts[a] > queueTypeCounts[b] ? a : b),
        "unassigned",
    );

    if (mostUsedQueueType !== value) {
        await updateDisplayedHashtags(mostUsedQueueType, queueTypes, tags, setSelectedQueueType, setDisplayedHashtags);
    }
}

/**
 * Handle bulk queue update for all posts
 */
export async function handleBulkQueueUpdate(
    queueType: string,
    deps: Pick<BulkPostsHandlerDeps, 'posts' | 'setPosts' | 'queueTypes' | 'tags' | 'user' | 'setDisplayedHashtags' | 'setSelectedQueueType' | 'firstItemTimeManuallyChanged'>
): Promise<void> {
    const { posts, setPosts, queueTypes, tags, user, setDisplayedHashtags, setSelectedQueueType, firstItemTimeManuallyChanged } = deps;

    if (posts.length === 0) return;

    // Update displayed hashtags
    await updateDisplayedHashtags(queueType, queueTypes, tags, setSelectedQueueType, setDisplayedHashtags);

    // Get the base schedule time from the API (this is the next available time after last scheduled post)
    let baseTime: string | null = null;
    if (queueType !== "unassigned") {
        // If first item time was manually changed, use it as base
        if (firstItemTimeManuallyChanged && posts[0].scheduledFor) {
            baseTime = posts[0].scheduledFor;
        } else {
            // Original behavior - fetch from API
            const selectedQueueType = queueTypes.find(qt =>
                (typeof qt === "string" ? qt : qt.name) === queueType
            );
            const queueTypeId = typeof selectedQueueType === "object" ? selectedQueueType.id : null;

            const requestBody = {
                queueTypeId,
                queueTypeName: queueType, // Keep for backward compatibility
                userId: user?.id,
            };

            const response = await fetch("/api/queue-schedule", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                const responseData = await response.json();
                const { scheduledTime } = responseData;
                baseTime = scheduledTime;
            }
        }
    }

    // Find the queue type configuration for bulk scheduling
    const queueTypeConfig = queueTypes.find((qt) => qt.name === queueType);

    const updatedPosts = posts.map((post, index) => {
        let scheduledFor = post.scheduledFor;

        // Auto-calculate schedule time if not unassigned
        if (queueType !== "unassigned" && baseTime && queueTypeConfig) {
            // Calculate each post's time based on the base time + offsets
            const baseDate = new Date(baseTime);
            let calculatedTime = "";

            if (queueTypeConfig.scheduleType === "INTERVAL") {
                const config = queueTypeConfig.scheduleConfig;
                let intervalHours = 4; // default

                if (config && isIntervalScheduleConfig(config)) {
                    if (config.useGlobalInterval) {
                        intervalHours = user?.scheduleInterval?.[0] || 4;
                    } else {
                        intervalHours = config.intervalHours || 4;
                    }
                }

                // Add interval * index to base time
                const newDate = new Date(baseDate);
                newDate.setHours(newDate.getHours() + index * intervalHours);

                // Format back to datetime-local format
                const year = newDate.getFullYear();
                const month = String(newDate.getMonth() + 1).padStart(2, "0");
                const day = String(newDate.getDate()).padStart(2, "0");
                const hours = String(newDate.getHours()).padStart(2, "0");
                const minutes = String(newDate.getMinutes()).padStart(2, "0");

                calculatedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else if (queueTypeConfig.scheduleType === "FIXED_SLOTS") {
                const config = queueTypeConfig.scheduleConfig;
                const slots = config && isFixedSlotsScheduleConfig(config) ? config.slots : [];

                if (slots.length > 0) {
                    // Sort slots to ensure consistent ordering
                    const sortedSlots = slots
                        .map((slot) => {
                            const [hours, minutes] = slot.split(":").map(Number);
                            return {
                                slot,
                                hours,
                                minutes,
                                totalMinutes: hours * 60 + minutes,
                            };
                        })
                        .sort((a, b) => a.totalMinutes - b.totalMinutes);

                    // Get the current slot index based on the base time
                    const baseHours = baseDate.getHours();
                    const baseMinutes = baseDate.getMinutes();
                    const baseTotalMinutes = baseHours * 60 + baseMinutes;

                    let currentSlotIndex = 0;
                    for (let i = 0; i < sortedSlots.length; i++) {
                        if (sortedSlots[i].totalMinutes >= baseTotalMinutes) {
                            currentSlotIndex = i;
                            break;
                        }
                    }

                    // Calculate which slot this post should use
                    const targetSlotIndex =
                        (currentSlotIndex + index) % sortedSlots.length;
                    const targetSlot = sortedSlots[targetSlotIndex];

                    // Calculate how many days to add
                    const daysToAdd = Math.floor(
                        (currentSlotIndex + index) / sortedSlots.length,
                    );

                    // Set the time to the target slot
                    const newDate = new Date(baseDate);
                    newDate.setHours(targetSlot.hours, targetSlot.minutes, 0, 0);
                    newDate.setDate(newDate.getDate() + daysToAdd);

                    // Format back to datetime-local format
                    const year = newDate.getFullYear();
                    const month = String(newDate.getMonth() + 1).padStart(2, "0");
                    const day = String(newDate.getDate()).padStart(2, "0");
                    const hours = String(newDate.getHours()).padStart(2, "0");
                    const minutes = String(newDate.getMinutes()).padStart(2, "0");

                    calculatedTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }

            if (calculatedTime) {
                scheduledFor = calculatedTime;
            }
        } else if (queueType === "unassigned") {
            scheduledFor = "";
        }

        return {
            ...post,
            queueType,
            scheduledFor,
        };
    });

    setPosts(updatedPosts);
}
