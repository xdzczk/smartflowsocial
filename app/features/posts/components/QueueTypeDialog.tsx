import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import type { QueueType } from "~/features/posts/types";
import { isIntervalScheduleConfig, isFixedSlotsScheduleConfig } from "~/features/posts/types";

interface QueueTypeDialogQueueType extends QueueType {
  isDefault?: boolean;
  hashTagPreset?: {
    id: string;
    name: string;
    tags: string;
    description?: string;
  } | null;
  hashTagPresetId?: string;
}

interface QueueTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueType?: QueueTypeDialogQueueType | null;
  hashTagPresets: {
    id: string;
    name: string;
    tags: string;
    description?: string;
  }[];
}

export function QueueTypeDialog({
  open,
  onOpenChange,
  queueType,
  hashTagPresets,
}: QueueTypeDialogProps) {
  interface FetcherData {
    success?: boolean;
    error?: string;
  }
  const fetcher = useFetcher<FetcherData>();
  const [scheduleType, setScheduleType] = useState<"INTERVAL" | "FIXED_SLOTS">(
    "INTERVAL",
  );
  const [hashTagPresetId, setHashTagPresetId] = useState<string>(
    queueType?.hashTagPresetId ?? "none",
  );

  const isEditing = !!queueType;
  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";

  useEffect(() => {
    if (queueType) {
      setScheduleType(queueType.scheduleType || "INTERVAL");
      setHashTagPresetId(queueType.hashTagPresetId || "none");
    } else {
      setScheduleType("INTERVAL");
      setHashTagPresetId("none");
    }
  }, [queueType]);

  useEffect(() => {
    if (fetcher.data?.success) {
      const action = isEditing ? "updated" : "created";
      toast.success(`Queue type ${action} successfully!`);
    }
    if (fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.data, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    if (isEditing) {
      formData.set("_action", "update_queue_type");
      formData.set("id", queueType.id);
    } else {
      formData.set("_action", "create_queue_type");
    }

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Queue Type" : "Create Queue Type"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the queue type settings below."
              : "Create a new queue type with custom scheduling."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={queueType?.name ?? ""}
              placeholder="e.g., Tech News"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={queueType?.description ?? ""}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              name="color"
              type="color"
              defaultValue={queueType?.color ?? "#3B82F6"}
              className="h-10 w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hashTagPresetId">Hashtag Preset (optional)</Label>
            <Select
              value={hashTagPresetId}
              onValueChange={setHashTagPresetId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a hashtag preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No hashtag preset</SelectItem>
                {hashTagPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Hidden input to ensure form submission includes the value */}
            <input
              type="hidden"
              name="hashTagPresetId"
              value={hashTagPresetId}
            />
            <p className="text-xs text-muted-foreground">
              Posts in this queue will automatically use the selected hashtag
              preset
            </p>
          </div>

          {isEditing ? (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isEnabled"
                name="isEnabled"
                defaultChecked={queueType?.isEnabled}
              />
              <Label htmlFor="isEnabled" className="text-sm font-normal">
                Enabled
              </Label>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="scheduleType">Schedule Type</Label>
            <Select
              name="scheduleType"
              value={scheduleType}
              onValueChange={(value) =>
                setScheduleType(value as "INTERVAL" | "FIXED_SLOTS")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERVAL">Interval-based</SelectItem>
                <SelectItem value="FIXED_SLOTS">Fixed time slots</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleType === "INTERVAL" ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useGlobalInterval"
                  name="useGlobalInterval"
                  defaultChecked={queueType?.scheduleConfig && isIntervalScheduleConfig(queueType.scheduleConfig) ? queueType.scheduleConfig.useGlobalInterval : false}
                />
                <Label
                  htmlFor="useGlobalInterval"
                  className="text-sm font-normal"
                >
                  Use global schedule intervals
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intervalHours">Hours between posts</Label>
                <Input
                  id="intervalHours"
                  name="intervalHours"
                  type="number"
                  min="1"
                  max="168"
                  defaultValue={queueType?.scheduleConfig && isIntervalScheduleConfig(queueType.scheduleConfig) ? (queueType.scheduleConfig.intervalHours || 4) : 4}
                />
              </div>
            </div>
          ) : null}

          {scheduleType === "FIXED_SLOTS" ? (
            <div className="space-y-2">
              <Label htmlFor="slots">
                Time slots (HH:MM format, comma separated)
              </Label>
              <Input
                id="slots"
                name="slots"
                defaultValue={
                  queueType?.scheduleConfig && isFixedSlotsScheduleConfig(queueType.scheduleConfig) ? (queueType.scheduleConfig.slots?.join(", ") || "") : ""
                }
                placeholder="08:00, 12:00, 18:00"
              />
              <p className="text-xs text-muted-foreground">
                Times are in your selected timezone
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg> : null}
              {isSubmitting
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
