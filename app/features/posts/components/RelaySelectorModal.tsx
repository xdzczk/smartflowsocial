/**
 * Modal to select which relays to use for this post.
 * Choose relay list source (account default vs app vs NIP-65), then toggle relays.
 */

import { useId, useState } from "react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import type {
  AccountPublishRelaySource,
  ComposerRelayListSource,
  ComposerRelayLists,
} from "~/features/relays/composer-relay-lists";

function formatRelayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch {
    return url;
  }
}

function relaySet(urls: string[]): Set<string> {
  return new Set(urls.map((u) => u.trim()).filter(Boolean));
}

export function sameRelaySet(a: string[], b: string[]): boolean {
  const A = relaySet(a);
  const B = relaySet(b);
  if (A.size !== B.size) return false;
  for (const x of A) {
    if (!B.has(x)) return false;
  }
  return true;
}

function listForSource(
  lists: ComposerRelayLists,
  source: ComposerRelayListSource
): string[] {
  if (source === "nip65_profile") return lists.nip65Profile;
  return lists[source];
}

function detectInitialSource(
  selectedRelays: string[],
  lists: ComposerRelayLists
): ComposerRelayListSource {
  if (sameRelaySet(selectedRelays, lists.default)) return "default";
  if (sameRelaySet(selectedRelays, lists.app)) return "app";
  if (sameRelaySet(selectedRelays, lists.nip65Profile)) return "nip65_profile";
  return "default";
}

interface RelaySelectorModalProps {
  relayLists: ComposerRelayLists;
  accountPublishRelaySource: AccountPublishRelaySource;
  /** Shown when the user has no per-post override (inherits account default at publish). */
  inheritRelays: boolean;
  /** Current checkbox selection when opening the modal. */
  selectedRelays: string[];
  onClose: () => void;
  /** `null` = inherit account default at publish time (no `relays` field on submit). */
  onSave: (urls: string[] | null) => void;
}

export function RelaySelectorModal({
  relayLists,
  accountPublishRelaySource,
  inheritRelays,
  selectedRelays,
  onClose,
  onSave,
}: RelaySelectorModalProps) {
  const fieldIdPrefix = useId();
  const initialSelection =
    inheritRelays || selectedRelays.length === 0
      ? relayLists.default
      : selectedRelays;

  const [activeSource, setActiveSource] = useState<ComposerRelayListSource>(
    () => detectInitialSource(initialSelection, relayLists)
  );
  const [urls, setUrls] = useState<string[]>(() => [...initialSelection]);

  const applySource = (source: ComposerRelayListSource) => {
    setActiveSource(source);
    setUrls([...listForSource(relayLists, source)]);
  };

  const toggle = (url: string) => {
    setUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const useAccountDefaultPreset = () => {
    applySource("default");
  };

  const handleSave = () => {
    const trimmed = urls.map((u) => u.trim()).filter(Boolean);
    if (trimmed.length === 0) return;

    if (
      activeSource === "default" &&
      sameRelaySet(trimmed, relayLists.default)
    ) {
      onSave(null);
    } else {
      onSave(trimmed);
    }
  };

  const baseList = listForSource(relayLists, activeSource);
  const relayList = Array.from(new Set([...baseList, ...urls])).filter(Boolean);

  const defaultHint =
    accountPublishRelaySource === "nip65_profile"
      ? "Account default follows your Nostr profile relay list (NIP-65)."
      : "Account default follows your SmartFlow app relay list.";

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post target: Relays</DialogTitle>
          <DialogDescription>
            Pick which relay list this post uses, then choose relays. Account
            default matches your Settings choice; you can override with the app
            or Nostr profile list for this post only.
          </DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground text-xs">{defaultHint}</p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeSource === "default" ? "default" : "outline"}
            size="sm"
            className="flex-1 min-[380px]:flex-none"
            onClick={() => applySource("default")}
          >
            Account default
          </Button>
          <Button
            type="button"
            variant={activeSource === "app" ? "default" : "outline"}
            size="sm"
            className="flex-1 min-[380px]:flex-none"
            onClick={() => applySource("app")}
          >
            SmartFlow app
          </Button>
          <Button
            type="button"
            variant={activeSource === "nip65_profile" ? "default" : "outline"}
            size="sm"
            className="flex-1 min-[380px]:flex-none"
            onClick={() => applySource("nip65_profile")}
          >
            Nostr profile
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useAccountDefaultPreset}
          >
            Use account default
          </Button>
        </div>

        <div className="space-y-2">
          {relayList.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No relays in this list.
            </p>
          ) : (
            relayList.map((url, index) => {
              const inputId = `${fieldIdPrefix}-relay-${index}`;
              return (
                <div
                  key={url}
                  className="flex items-center gap-2 rounded border p-2"
                >
                  <Checkbox
                    id={inputId}
                    checked={urls.includes(url)}
                    onCheckedChange={() => toggle(url)}
                  />
                  <Label
                    htmlFor={inputId}
                    className="text-muted-foreground cursor-pointer truncate text-sm"
                  >
                    {formatRelayUrl(url)}
                  </Label>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={urls.filter((u) => u.trim()).length === 0}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
