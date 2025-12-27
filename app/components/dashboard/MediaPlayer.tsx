import { useState, useRef, useEffect } from "react";
import type React from "react";
interface MediaPlayerProps {
  src: string;
  alt?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string; // For video poster image
}

// Helper function to determine if URL is a video based on file extension or MIME hints
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".ogg",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
  ];
  const lowerUrl = url.toLowerCase();

  // Check for video file extensions
  return videoExtensions.some((ext) => lowerUrl.includes(ext));
};

export default function MediaPlayer({
  src,
  alt = "Media content",
  className = "",
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  poster,
}: MediaPlayerProps) {
  const [isVideo, setIsVideo] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Initial guess based on URL
    setIsVideo(isVideoUrl(src));
  }, [src]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setIsVideo(false);
  };

  const handleImageError = () => {
    // If image fails to load, it might be a video
    setIsLoading(false);
    setIsVideo(true);
    setHasError(false);
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
    setIsVideo(true);
    setHasError(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 ${className}`}
      >
        <div className="text-center">
          <div className="mb-2 text-gray-500">
            <svg
              className="mx-auto h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Unable to load media</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`flex animate-pulse items-center justify-center bg-gray-200 dark:bg-gray-700 ${className}`}
      >
        <div className="text-gray-500">
          <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>
    );
  }

  // If we determined it's a video or our initial guess was video
  if (isVideo) {
    return (
      <video
        ref={videoRef}
        className={className}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        poster={poster}
        onLoadedMetadata={handleVideoLoad}
        onError={handleVideoError}
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
        <source src={src} type="video/ogg" />
        <track kind="captions" srcLang="en" label="English" />
        Your browser does not support the video tag.
      </video>
    );
  }

  // Default to image
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onLoad={handleImageLoad}
      onError={handleImageError}
      loading="lazy"
    />
  );
}

// Utility component for media thumbnails with play button overlay
export function MediaThumbnail({
  src,
  alt = "Media thumbnail",
  className = "w-full h-48 object-cover",
  onClick,
}: {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}) {
  const isVideo = isVideoUrl(src);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div 
      className="group relative cursor-pointer" 
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <MediaPlayer
        src={src}
        alt={alt}
        className={className}
        controls={false}
        autoPlay={false}
        muted={true}
      />
      {isVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-all duration-200 group-hover:bg-opacity-50">
          <div className="rounded-full bg-white bg-opacity-90 p-3 transition-all duration-200 group-hover:bg-opacity-100">
            <svg
              className="h-8 w-8 text-gray-800"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      ) : null}
      {/* Media type indicator */}
      <div className="absolute left-2 top-2 rounded bg-black bg-opacity-70 px-2 py-1 text-xs text-white">
        {isVideo ? "🎥" : "🖼️"}
      </div>
    </div>
  );
}

// Utility component for full-screen media modal
export function MediaModal({
  src,
  alt = "Media content",
  isOpen,
  onClose,
}: {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="relative max-h-full max-w-7xl p-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black bg-opacity-50 p-2 text-white transition-all hover:bg-opacity-70"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <MediaPlayer
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-full object-contain"
          controls={true}
          autoPlay={isVideoUrl(src)}
          muted={false}
        />
      </div>
    </div>
  );
}
