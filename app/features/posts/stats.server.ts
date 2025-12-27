
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

            const data = await response.json() as [string, unknown, { kind?: number; content?: string }][];
            // Find the stats event in the response array
            // The stats event has kind 10000100 and contains engagement metrics
            const statsEvent = data.find(
                (event: [string, unknown, { kind?: number; content?: string }]) => {
                    if (event[0] !== "EVENT" || !event[2]) return false;
                    const eventData = event[2];
                    if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) return false;
                    const eventTyped = eventData as { kind?: number; content?: string };
                    return eventTyped.kind === 10000100 &&
                        eventTyped.content &&
                        typeof eventTyped.content === "string" &&
                        eventTyped.content.includes(eventId);
                },
            );

            if (statsEvent?.[2] && typeof statsEvent[2] === "object" && !Array.isArray(statsEvent[2])) {
                const eventData = statsEvent[2] as { kind?: number; content?: string };
                if (eventData.content && typeof eventData.content === "string") {
                    const content = JSON.parse(eventData.content) as {
                        likes?: number;
                        replies?: number;
                        mentions?: number;
                        reposts?: number;
                        zaps?: number;
                        satszapped?: number;
                    };
                    return {
                        [eventId]: {
                            likes: content.likes || 0,
                            replies: content.replies || 0,
                            mentions: content.mentions || 0,
                            reposts: content.reposts || 0,
                            zaps: content.zaps || 0,
                            satszapped: content.satszapped || 0,
                        },
                    };
                }
            }

            return {
                [eventId]: {
                    likes: 0,
                    replies: 0,
                    mentions: 0,
                    reposts: 0,
                    zaps: 0,
                    satszapped: 0,
                },
            };
        });

        const statsResults = await Promise.all(statsPromises);
        stats = statsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        clearTimeout(timeoutId);
    } catch (error) {
        console.error("Error fetching stats:", error);
        // Initialize empty stats object with 0 values for each post
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
        }, {} as Record<string, PostStats>);
    }

    return stats;
}
