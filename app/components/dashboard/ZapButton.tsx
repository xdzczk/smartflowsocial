import { useEffect } from "react";
interface ZapButtonProps {
  npub: string;
}

export default function ZapButton({ npub }: ZapButtonProps) {
  useEffect(() => {
    // Initialize nostr-zap after component mounts
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/nostr-zap@0.20.0";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      document.body.removeChild(script);
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
