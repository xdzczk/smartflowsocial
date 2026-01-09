import { PlayIcon } from "@heroicons/react/20/solid";
import React, { useState } from "react";
interface MediaPlayerProps {
  src: string;
  alt?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  poster?: string;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  src,
  alt = "Media content",
  className = "",
  autoPlay = false,
  controls = true,
  poster,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Determine if the source is a video based on file extension
  const isVideo = React.useMemo(() => {
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
  }, [src]);

  const handleVideoClick = async (
    event: React.MouseEvent<HTMLVideoElement>
  ) => {
    const video = event.currentTarget;
    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        // Handle play() rejection silently
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  if (!isVideo) {
    // Render image
    return <img src={src} alt={alt} className={className} loading="lazy" />;
  }

  // Render video
  return (
    <div className={`relative ${className}`}>
      <video
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        controls={controls}
        className="h-full w-full object-cover"
        onClick={(e) => void handleVideoClick(e)}
        onEnded={handleVideoEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      >
        <track kind="captions" srcLang="en" label="English" />
      </video>
      {!isPlaying ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-opacity-50 rounded-full bg-black p-3">
            <PlayIcon className="h-8 w-8 text-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MediaPlayer;
