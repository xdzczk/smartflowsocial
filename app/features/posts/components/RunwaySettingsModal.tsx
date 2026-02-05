import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

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

interface RunwaySettings {
  queueNames: string[];
  mode: "last-post" | "first-queue-empty";
}
interface QueueTypeItem {
  id: string;
  name: string;
}

export interface RunwaySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueTypes: QueueTypeItem[];
  runwaySettings: RunwaySettings | null | undefined;
  onSuccess?: () => void;
}

export function RunwaySettingsModal({
  open,
  onOpenChange,
  queueTypes,
  runwaySettings,
  onSuccess,
}: RunwaySettingsModalProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const allNames = queueTypes.map((qt) => qt.name);
  const defaultSelected =
    !runwaySettings || runwaySettings.queueNames.length === 0
      ? allNames
      : runwaySettings.queueNames.filter((n) => allNames.includes(n));

  const [selectedQueueNames, setSelectedQueueNames] =
    useState<string[]>(defaultSelected);
  const [mode, setMode] = useState<RunwaySettings["mode"]>(
    runwaySettings?.mode ?? "last-post"
  );

  const prevOpenRef = useRef(false);
  const didSubmitRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const names = queueTypes.map((qt) => qt.name);
      const initial =
        !runwaySettings || runwaySettings.queueNames.length === 0
          ? names
          : runwaySettings.queueNames.filter((n) => names.includes(n));
      const nextMode = runwaySettings?.mode ?? "last-post";
      queueMicrotask(() => {
        setSelectedQueueNames(initial);
        setMode(nextMode);
      });
      didSubmitRef.current = false;
    }
    prevOpenRef.current = open;
  }, [open, queueTypes, runwaySettings]);

  useEffect(() => {
    if (
      didSubmitRef.current &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      didSubmitRef.current = false;
      onSuccess?.();
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onSuccess, onOpenChange]);

  const handleSave = () => {
    didSubmitRef.current = true;
    const formData = new FormData();
    formData.set("_action", "updateRunwaySettings");
    formData.set("mode", mode);
    selectedQueueNames.forEach((name) => formData.append("queueNames", name));
    fetcher.submit(formData, { method: "post" });
  };

  const toggleQueue = (name: string) => {
    setSelectedQueueNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectAll = () => setSelectedQueueNames([...allNames]);
  const deselectAll = () => setSelectedQueueNames([]);

  const isNoneSelected = selectedQueueNames.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Runway settings</DialogTitle>
          <DialogDescription>
            Choose which queues count toward Runway and how the number is
            calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fetcher.data?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {fetcher.data.error}
            </p>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Queues that count</Label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  Select all
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  Deselect all
                </button>
              </div>
            </div>
            {queueTypes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No queues yet. Create a queue to filter Runway.
              </p>
            ) : (
              <ul className="border-border flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-2">
                {queueTypes.map((qt) => (
                  <li key={qt.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`runway-queue-${qt.id}`}
                      checked={selectedQueueNames.includes(qt.name)}
                      onCheckedChange={() => toggleQueue(qt.name)}
                    />
                    <Label
                      htmlFor={`runway-queue-${qt.id}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {qt.name}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Runway shows</Label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="runwayMode"
                  value="last-post"
                  checked={mode === "last-post"}
                  onChange={() => setMode("last-post")}
                  className="mt-1"
                />
                <span className="text-sm">
                  Days until <strong>last</strong> scheduled post (from selected
                  queues)
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="runwayMode"
                  value="first-queue-empty"
                  checked={mode === "first-queue-empty"}
                  onChange={() => setMode("first-queue-empty")}
                  className="mt-1"
                />
                <span className="text-sm">
                  Days until <strong>first</strong> selected queue runs out
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={fetcher.state !== "idle" || isNoneSelected}
          >
            {fetcher.state !== "idle" ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
