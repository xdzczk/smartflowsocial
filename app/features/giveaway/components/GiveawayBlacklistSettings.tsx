import { useFetcher, useRevalidator } from "@remix-run/react";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ManagementListSection } from "~/features/settings/components/patterns";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { formDataToFormData } from "~/lib/validation/utils.client-safe";

interface GiveawayBlacklistSettingsProps {
  giveawayBlacklist: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function GiveawayBlacklistSettings({
  giveawayBlacklist,
}: GiveawayBlacklistSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  const [input, setInput] = useState("");
  const [items, setItems] = useState<string[]>(giveawayBlacklist);

  useEffect(() => {
    setItems(giveawayBlacklist);
  }, [giveawayBlacklist]);

  const wasSubmittingRef = useRef(false);
  useEffect(() => {
    const wasSubmitting = wasSubmittingRef.current;
    wasSubmittingRef.current = fetcher.state === "submitting";
    if (!wasSubmitting || fetcher.state !== "idle") return;
    if (fetcher.data?.success) {
      toast.success("Blacklist updated");
      revalidatorRef.current.revalidate();
    } else if (fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  const pending = fetcher.state !== "idle";

  const persist = (next: string[]) => {
    const formData = formDataToFormData(
      { blacklist: next.join("\n") },
      "update_blacklist"
    );
    fetcher.submit(formData, { method: "post", action: "/dashboard/settings" });
  };

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("npub")) {
      toast.error("Address must start with npub");
      return;
    }
    if (items.includes(trimmed)) {
      toast.error("Already on the list");
      return;
    }
    persist([...items, trimmed]);
    setInput("");
  };

  const handleRemove = (npub: string) => {
    persist(items.filter((x) => x !== npub));
  };

  return (
    <ManagementListSection
      title="Giveaway blacklist"
      description="Block these npubs from participating in giveaways and contests."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="npub1…"
            disabled={pending}
            className="font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !input.trim()}
          onClick={handleAdd}
          className="shrink-0"
        >
          Add npub
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No blocked npubs. Add an address above to exclude it from giveaways.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((npub) => (
            <li
              key={npub}
              className="border-border/60 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
                {npub}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                disabled={pending}
                aria-label={`Remove ${npub.slice(0, 12)}…`}
                onClick={() => handleRemove(npub)}
              >
                <Trash2 className={INLINE_ICON_SIZE_CLASS} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ManagementListSection>
  );
}
