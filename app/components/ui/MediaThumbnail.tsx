import { PlayIcon } from "@heroicons/react/20/solid";
import React from "react";

interface MediaThumbnailProps {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
  forceType?: "image" | "video";
  onError?: () => void;
  fallback?: React.ReactNode;
  hidePlayButton?: boolean;
}

const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  src,
  alt = "Media thumbnail",
  className = "",
  onClick,
  forceType,
  onError,
  fallback,
  hidePlayButton = false,
}) => {
  const [hasError, setHasError] = React.useState(false);

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  // Determine if the source is a video based on extension, unless forceType is provided
  const isVideo = React.useMemo(() => {
    if (forceType === "video") return true;
    if (forceType === "image") return false;
    // Handle undefined/null src safely
    if (!src || typeof src !== "string") return false;
    const lower = src.toLowerCase();
    const videoExtensions = [
      ".mp4",
      ".webm",
      ".ogg",
      ".mov",
      ".avi",
      ".mkv",
      ".m4v",
    ];
    return videoExtensions.some((ext) => lower.includes(ext));
  }, [src, forceType]);

  // Handle missing src early
  if (!src || typeof src !== "string") {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400 ${className}`}
      >
        NO MEDIA
      </div>
    );
  }

  const handleImageError = () => {
    setHasError(true);
    onError?.();
  };

  const handleImageLoad = () => {
    // Image loaded successfully
  };

  // Return fallback if there's an error
  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  // Return generic fallback for broken images
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400 ${className}`}
      >
        TEXT
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  if (!isVideo) {
    // Render image thumbnail
    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      <img
        src={src}
        alt={alt}
        className={`${className} ${onClick ? "cursor-pointer hover:opacity-75" : ""}`}
        onClick={onClick}
        onKeyDown={onClick ? handleKeyDown : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        loading="lazy"
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    );
  }

  // Render video thumbnail with play button overlay
  return (
    <div
      className={`relative ${className} ${onClick ? "cursor-pointer hover:opacity-75" : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <video
        src={src}
        className="h-full w-full object-cover"
        preload="metadata"
        muted
        controls={false}
        disablePictureInPicture
        onError={handleImageError}
        onLoadedData={handleImageLoad}
      />
      {!hidePlayButton ? <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black bg-opacity-60 p-2 shadow-lg">
            <PlayIcon className="h-6 w-6 text-white drop-shadow-sm" />
          </div>
        </div> : null}
    </div>
  );
};

export default MediaThumbnail;
