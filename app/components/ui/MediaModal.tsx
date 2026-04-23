import { X } from "lucide-react";
import { useEffect } from "react";
import type React from "react";

import MediaPlayer from "./MediaPlayer";
interface MediaModalProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

const MediaModal: React.FC<MediaModalProps> = ({
  src,
  alt = "Media content",
  isOpen,
  onClose,
}) => {
  // Handle escape key press (stop propagation so parent modals e.g. Post Details stay open)
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape, true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape, true);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal content */}
      <div className="relative z-10 max-h-full max-w-full p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 z-20 text-white hover:text-white/80"
          aria-label="Close modal"
        >
          <X className="h-8 w-8" />
        </button>

        {/* Media content */}
        <div className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg">
          <MediaPlayer
            src={src}
            alt={alt}
            className="max-h-full max-w-full"
            controls={true}
          />
        </div>
      </div>
    </div>
  );
};

export default MediaModal;
