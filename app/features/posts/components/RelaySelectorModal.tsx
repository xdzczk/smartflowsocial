/**
 * Modal to select which relays to use for this post.
 * Default = loader relays; user can override.
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

function formatRelayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch {
    return url;
  }
}

interface RelaySelectorModalProps {
  defaultRelays: string[];
  selectedRelays: string[];
  onClose: () => void;
  onSave: (urls: string[]) => void;
}

export function RelaySelectorModal({
  defaultRelays,
  selectedRelays,
  onClose,
  onSave,
}: RelaySelectorModalProps) {
  const fieldIdPrefix = useId();
  const [urls, setUrls] = useState<string[]>(() =>
    selectedRelays.length > 0 ? [...selectedRelays] : [...defaultRelays]
  );

  const toggle = (url: string) => {
    setUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const useDefault = () => {
    setUrls([...defaultRelays]);
  };

  const handleSave = () => {
    onSave(urls.filter(Boolean));
  };

  const relayList = Array.from(
    new Set([...defaultRelays, ...urls].filter(Boolean))
  );

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post target: Relays</DialogTitle>
          <DialogDescription>
            Choose which relays this post will be published to. Leave as default
            to use your configured relays.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useDefault}
          >
            Use default
          </Button>
        </div>
        <div className="space-y-2">
          {relayList.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No relays configured.
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
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
