import { XMarkIcon } from "@heroicons/react/20/solid";
import React, { useEffect } from "react";

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
  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-75"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 max-h-full max-w-full p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 z-20 text-white hover:text-gray-300"
          aria-label="Close modal"
        >
          <XMarkIcon className="h-8 w-8" />
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
