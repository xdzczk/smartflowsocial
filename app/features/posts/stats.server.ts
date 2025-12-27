
export interface PostStats {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
}

export async function getPostStats(eventIds: string[]): Promise<Record<string, PostStats>> {
    let stats: Record<string, PostStats> = {};

    if (eventIds.length === 0) {
        return stats;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Fetch stats for each event ID
        const statsPromises = eventIds.map(async (eventId) => {
            const response = await fetch(process.env.PRIMAL_CACHING_URL!, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requestType: "thread_view",
                    params: {
                        event_id: eventId,
                    },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error("Failed to fetch stats");
            }

            const dataRaw: unknown = await response.json();
            const data: unknown[] = Array.isArray(dataRaw) ? dataRaw : [];
            // Find the stats event in the response array
            // The stats event has kind 10000100 and contains engagement metrics
            const statsEvent: unknown = data.find(
                (event: unknown) => {
                    if (!Array.isArray(event) || event.length < 3 || event[0] !== "EVENT") return false;
                    const eventDataRaw: unknown = event[2];
                    const eventData: unknown = eventDataRaw;
                    if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) return false;
                    const eventTyped = eventData as { kind?: unknown; content?: unknown };
                    return typeof eventTyped.kind === "number" && eventTyped.kind === 10000100 &&
                        eventTyped.content &&
                        typeof eventTyped.content === "string" &&
                        eventTyped.content.includes(eventId);
                },
            );

            if (Array.isArray(statsEvent) && statsEvent[2] && typeof statsEvent[2] === "object" && !Array.isArray(statsEvent[2])) {
                const eventData = statsEvent[2] as { kind?: unknown; content?: unknown };
                if (eventData.content && typeof eventData.content === "string") {
                    let content: {
                        likes?: number;
                        replies?: number;
                        mentions?: number;
                        reposts?: number;
                        zaps?: number;
                        satszapped?: number;
                        } = {};
                    try {
                        const parsed: unknown = JSON.parse(eventData.content ?? "");
                        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                            const parsedObj = parsed as Record<string, unknown>;
                            content = {
                                likes: typeof parsedObj.likes === "number" ? parsedObj.likes : undefined,
                                replies: typeof parsedObj.replies === "number" ? parsedObj.replies : undefined,
                                mentions: typeof parsedObj.mentions === "number" ? parsedObj.mentions : undefined,
                                reposts: typeof parsedObj.reposts === "number" ? parsedObj.reposts : undefined,
                                zaps: typeof parsedObj.zaps === "number" ? parsedObj.zaps : undefined,
                                satszapped: typeof parsedObj.satszapped === "number" ? parsedObj.satszapped : undefined,
                            };
                        }
                    } catch {
                        // If parsing fails, use empty content
                    }
                    return {
                        [eventId]: {
                            likes: content.likes ?? 0,
                            replies: content.replies ?? 0,
                            mentions: content.mentions ?? 0,
                            reposts: content.reposts ?? 0,
                            zaps: content.zaps ?? 0,
                            satszapped: content.satszapped ?? 0,
                        },
                    };
                }
            }

            const statsValue: PostStats = {
                likes: 0,
                replies: 0,
                mentions: 0,
                reposts: 0,
                zaps: 0,
                satszapped: 0,
            };
            const result: Record<string, PostStats> = {
                [eventId]: statsValue,
            };
            return result;
        });

        const statsResults = await Promise.all(statsPromises);
        stats = statsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        clearTimeout(timeoutId);
    } catch (error) {
        console.error("Error fetching stats:", error);
        // Initialize empty stats object with 0 values for each post
        const emptyStats: Record<string, PostStats> = {};
        stats = eventIds.reduce((acc, eventId) => {
            acc[eventId] = {
                likes: 0,
                replies: 0,
                mentions: 0,
                reposts: 0,
                zaps: 0,
                satszapped: 0,
            };
            return acc;
        }, emptyStats);
    }

    return stats;
}
