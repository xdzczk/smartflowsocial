import { nip19 } from "nostr-tools";
export const getTimeRemaining = (
  scheduledDate: string | Date,
  currentTime: Date = new Date()
): string => {
  const scheduleUTC = new Date(scheduledDate);
  const currentUTC = new Date(currentTime);

  const total = scheduleUTC.getTime() - currentUTC.getTime();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export function convertToHex(key: string): string | null {
  try {
    const { data } = nip19.decode(key);
    return typeof data === "string" ? data : null;
  } catch (error) {
    console.error("Error decoding npub:", error);
    return null;
  }
}

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const getImageUrls = (fileUrl: string[]): string[] => {
  if (fileUrl.length === 0) return [];

  // Handle case where fileUrl is an array of JSON strings
  if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
    try {
      return JSON.parse(fileUrl[0]) as string[];
    } catch (e) {
      console.error("Error parsing fileUrl:", e);
      return [];
    }
  }

  // Handle direct URLs
  return fileUrl;
};

/**
 * Determines if a URL points to a video file based on its extension
 * @param url - The URL to check
 * @returns true if the URL appears to be a video file
 */
export const isVideoFile = (url: string): boolean => {
  if (typeof url !== "string") return false;

  const lowerUrl = url.toLowerCase();
  const videoExtensions = [
    ".mp4",
    ".mov",
    ".webm",
    ".ogg",
    ".avi",
    ".mkv",
    ".m4v",
    ".3gp",
    ".flv",
    ".wmv",
  ];

  // Check if URL ends with a video extension (after removing query params and fragments)
  const urlWithoutQuery = lowerUrl.split("?")[0]?.split("#")[0];
  if (!urlWithoutQuery) return false;
  return videoExtensions.some((ext) => urlWithoutQuery.endsWith(ext));
};
