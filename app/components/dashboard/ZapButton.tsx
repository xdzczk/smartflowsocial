import { useEffect } from "react";
interface ZapButtonProps {
  npub: string;
}

// Global flag to track if script is already loaded
let nostrZapScriptLoaded = false;
let nostrZapScriptElement: HTMLScriptElement | null = null;

export default function ZapButton({ npub }: ZapButtonProps) {
  useEffect(() => {
    // Only load script once globally, not per component instance
    if (!nostrZapScriptLoaded && !nostrZapScriptElement) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/nostr-zap@0.20.0";
      script.async = true;
      script.id = "nostr-zap-script"; // Add ID to prevent duplicates

      // Mark as loaded before appending to prevent race conditions
      nostrZapScriptLoaded = true;
      nostrZapScriptElement = script;

      document.body.appendChild(script);
    }

    // Don't remove script on unmount - it's shared across all ZapButton instances
    return () => {
      // No cleanup needed - script stays loaded for other instances
    };
  }, []);

  return (
    <button
      id="nostr-zap-target"
      data-npub={npub}
      data-relays="wss://relay.damus.io,wss://relay.snort.social,wss://nostr.wine,wss://relay.nostr.band"
      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#004e92] bg-gradient-to-r from-[#000428] to-[#004e92] px-6 py-3 text-base font-bold text-gray-100 transition duration-200 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-[#004e92]/40 focus:ring-2 focus:ring-[#004e92] focus:ring-offset-2 focus:outline-none active:scale-95 dark:text-white"
    >
      Zap Me ⚡️
    </button>
  );
}
