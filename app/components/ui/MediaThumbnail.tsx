import { Play } from "lucide-react";
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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const videoWrapRef = React.useRef<HTMLDivElement>(null);
  const [shouldPreloadFrame, setShouldPreloadFrame] = React.useState(false);

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

  // When video: preload first frame once in view so Calendar previews show (hooks must run unconditionally)
  React.useEffect(() => {
    if (!isVideo) return;
    const el = videoWrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) setShouldPreloadFrame(true);
      },
      { rootMargin: "100px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVideo]);

  React.useEffect(() => {
    if (!shouldPreloadFrame || !videoRef.current) return;
    const video = videoRef.current;
    video.preload = "auto";
    video.load();
  }, [shouldPreloadFrame]);

  // Handle missing src early
  if (!src || typeof src !== "string") {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-surface-hover text-text-secondary flex items-center justify-center text-xs font-medium ${className}`}
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
        className={`bg-surface-hover text-text-secondary flex items-center justify-center text-xs font-medium ${className}`}
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
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Image thumbnails need click handlers for preview
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
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- onClick is optional, role and tabIndex are conditionally set
    <div
      ref={videoWrapRef}
      className={`relative ${className} ${onClick ? "cursor-pointer hover:opacity-75" : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      {...(onClick && { role: "button", tabIndex: 0 })}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full object-cover"
        preload={shouldPreloadFrame ? "auto" : "metadata"}
        muted
        playsInline
        controls={false}
        disablePictureInPicture
        onError={handleImageError}
        onLoadedData={handleImageLoad}
      />
      {!hidePlayButton ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-opacity-60 shadow-2 rounded-full bg-black p-2">
            <Play className="h-6 w-6 text-white drop-shadow-sm" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MediaThumbnail;
