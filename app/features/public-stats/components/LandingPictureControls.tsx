import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";

import { Switch } from "~/components/ui/switch";
import { ToggleRowSection } from "~/features/settings/components/patterns";

interface Presence {
  hideFromLanding?: boolean;
  showNotice?: boolean;
  ok?: boolean;
}

const ENDPOINT = "/api/landing-presence";

export function LandingPictureSettings() {
  const fetcher = useFetcher<Presence>();

  useEffect(() => {
    fetcher.load(ENDPOINT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher identity changes every render
  }, []);

  const hide = fetcher.data?.hideFromLanding === true;
  const shown = !hide;

  return (
    <ToggleRowSection
      label="Show my picture on smartflow.social"
      description="Your public Nostr picture and name appear with other people who published in the last 30 days. No posts or numbers are shown per account."
      control={
        <Switch
          checked={shown}
          disabled={fetcher.state !== "idle"}
          aria-label="Show my picture on smartflow.social"
          onCheckedChange={(next) => {
            const formData = new FormData();
            formData.set("intent", "visibility");
            formData.set("hideFromLanding", next ? "false" : "true");
            fetcher.submit(formData, { method: "post", action: ENDPOINT });
          }}
        />
      }
    />
  );
}

export function LandingPictureNotice() {
  const loader = useFetcher<Presence>();
  const dismiss = useFetcher<Presence>();

  useEffect(() => {
    loader.load(ENDPOINT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher identity changes every render
  }, []);

  if (!loader.data?.showNotice || dismiss.data?.ok) return null;

  return (
    <div className="border-border/60 bg-card border-b">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-4 py-3 sm:px-6">
        <p className="text-sm leading-6">
          Your picture now appears in the &ldquo;who uses it&rdquo; row on
          smartflow.social. Turn it off in Settings.
        </p>
        <button
          type="button"
          className="shrink-0 text-sm font-semibold"
          onClick={() => {
            const formData = new FormData();
            formData.set("intent", "dismiss");
            dismiss.submit(formData, { method: "post", action: ENDPOINT });
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
