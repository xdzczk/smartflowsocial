import { useFetcher, useRevalidator } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "react-hot-toast";
import type { z } from "zod";

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
import { queueTypeClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import { useZodForm, formDataToFormData } from "~/lib/validation/utils.client";

import type { QueueType } from "../types";
import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";

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
  hashTagPresets: Array<{
    id: string;
    name: string;
    tags: string;
    description?: string;
  }>;
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
  const revalidator = useRevalidator();
  const lastHandledSuccessRef = useRef<unknown>(null);
  const isEditing = !!queueType;

  const DAY_LABELS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ] as const;

  // Initialize form with default values
  const getDefaultValues = () => {
    if (queueType) {
      const scheduleConfig = queueType.scheduleConfig;
      return {
        name: queueType.name,
        description: queueType.description ?? "",
        color: queueType.color ?? "#3B82F6",
        hashTagPresetId: queueType.hashTagPresetId ?? "none",
        scheduleType: queueType.scheduleType ?? "INTERVAL",
        isEnabled: queueType.isEnabled ?? false,
        useGlobalInterval:
          scheduleConfig && isIntervalScheduleConfig(scheduleConfig)
            ? scheduleConfig.useGlobalInterval
            : false,
        intervalHours:
          scheduleConfig && isIntervalScheduleConfig(scheduleConfig)
            ? (scheduleConfig.intervalHours?.toString() ?? "")
            : "",
        slots:
          scheduleConfig && isFixedSlotsScheduleConfig(scheduleConfig)
            ? scheduleConfig.slots.join(", ")
            : "",
        weeklySlots:
          scheduleConfig && isWeeklySlotsScheduleConfig(scheduleConfig)
            ? scheduleConfig.weeklySlots
            : undefined,
      };
    }
    return {
      name: "",
      description: "",
      color: "#3B82F6",
      hashTagPresetId: "none",
      scheduleType: "INTERVAL" as const,
      isEnabled: false,
      useGlobalInterval: false,
      intervalHours: "",
      slots: "",
      weeklySlots: undefined as
        | Array<{ dayOfWeek: number; time: string }>
        | undefined,
    };
  };

  const form = useZodForm(queueTypeClientSchema, {
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useZodFieldArray<
    z.infer<typeof queueTypeClientSchema>,
    "weeklySlots"
  >(
    form as unknown as UseFormReturn<z.infer<typeof queueTypeClientSchema>>,
    "weeklySlots"
  );

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";
  const scheduleType = form.watch("scheduleType");
  const hashTagPresetId = form.watch("hashTagPresetId");

  useEffect(() => {
    if (!open) {
      lastHandledSuccessRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    const fetcherData = fetcher.data;
    if (
      fetcherData &&
      typeof fetcherData === "object" &&
      !Array.isArray(fetcherData)
    ) {
      const data = fetcherData as FetcherData;
      if (typeof data.success === "boolean" && data.success) {
        if (lastHandledSuccessRef.current !== fetcherData) {
          lastHandledSuccessRef.current = fetcherData;
          revalidator.revalidate();
          const action = isEditing ? "updated" : "created";
          toast.success(`Queue type ${action} successfully!`);
          onOpenChange(false);
        }
      }
      if (typeof data.error === "string") {
        toast.error(data.error);
      }
    }
  }, [fetcher.data, isEditing, onOpenChange, open, revalidator]);

  const onSubmit = form.handleSubmit((data) => {
    // Transform data for FormData submission
    const submitData: Record<string, unknown> = {
      name: data.name,
      description: data.description ?? "",
      color: data.color,
      hashTagPresetId:
        data.hashTagPresetId === "none" || !data.hashTagPresetId
          ? "none"
          : data.hashTagPresetId,
      scheduleType: data.scheduleType,
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      ...(data.useGlobalInterval !== undefined
        ? { useGlobalInterval: data.useGlobalInterval }
        : {}),
      ...(data.intervalHours ? { intervalHours: data.intervalHours } : {}),
      ...(data.slots ? { slots: data.slots } : {}),
      ...(data.scheduleType === "WEEKLY_SLOTS" && data.weeklySlots?.length
        ? { weeklySlots: JSON.stringify(data.weeklySlots) }
        : {}),
    };

    const formData = formDataToFormData(
      submitData,
      isEditing ? "update_queue_type" : "create_queue_type"
    );

    if (isEditing) {
      formData.set("id", queueType.id);
    }

    fetcher.submit(formData, { method: "post" });
  });

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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g., Tech News"
            />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...form.register("description")}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              type="color"
              {...form.register("color")}
              className="h-10 w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hashTagPresetId">Hashtag Preset (optional)</Label>
            <Select
              value={hashTagPresetId ?? "none"}
              onValueChange={(value) => {
                form.setValue("hashTagPresetId", value);
              }}
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
            <p className="text-muted-foreground text-xs">
              Posts in this queue will automatically use the selected hashtag
              preset
            </p>
          </div>

          {isEditing ? (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isEnabled"
                checked={form.watch("isEnabled")}
                onCheckedChange={(checked) => {
                  form.setValue("isEnabled", checked as boolean);
                }}
              />
              <Label htmlFor="isEnabled" className="text-sm font-normal">
                Enabled
              </Label>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="scheduleType">Schedule Type</Label>
            <Select
              value={scheduleType}
              onValueChange={(value) => {
                const newType = value as
                  | "INTERVAL"
                  | "FIXED_SLOTS"
                  | "WEEKLY_SLOTS";
                form.setValue("scheduleType", newType);
                if (
                  newType === "WEEKLY_SLOTS" &&
                  (form.getValues("weeklySlots")?.length ?? 0) === 0
                ) {
                  form.setValue("weeklySlots", [
                    { dayOfWeek: 1, time: "09:00" },
                  ]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERVAL">Interval-based</SelectItem>
                <SelectItem value="FIXED_SLOTS">Fixed time slots</SelectItem>
                <SelectItem value="WEEKLY_SLOTS">
                  Weekly schedule (day + time)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleType === "INTERVAL" ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useGlobalInterval"
                  checked={form.watch("useGlobalInterval")}
                  onCheckedChange={(checked) => {
                    form.setValue("useGlobalInterval", checked as boolean);
                  }}
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
                  type="number"
                  min="1"
                  max="168"
                  {...form.register("intervalHours")}
                />
                {form.formState.errors.intervalHours ? (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.intervalHours.message}
                  </p>
                ) : null}
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
                {...form.register("slots")}
                placeholder="08:00, 12:00, 18:00"
              />
              {form.formState.errors.slots ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.slots.message}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Times are in your selected timezone
              </p>
            </div>
          ) : null}

          {scheduleType === "WEEKLY_SLOTS" ? (
            <div className="space-y-2">
              <Label>Weekly slots (day + time)</Label>
              <p className="text-muted-foreground text-xs">
                Add one or more day and time combinations. Times are in your
                selected timezone.
              </p>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                >
                  <Select
                    value={String(
                      form.watch(`weeklySlots.${index}.dayOfWeek`) ?? 1
                    )}
                    onValueChange={(val) =>
                      form.setValue(
                        `weeklySlots.${index}.dayOfWeek`,
                        Number(val)
                      )
                    }
                  >
                    <SelectTrigger className="w-[140px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((label, i) => (
                        <SelectItem key={label} value={String(i)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    className="w-[120px] shrink-0"
                    {...form.register(`weeklySlots.${index}.time`)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    aria-label="Remove slot"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ dayOfWeek: 1, time: "09:00" })}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add slot
              </Button>
              {form.formState.errors.weeklySlots ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.weeklySlots.message}
                </p>
              ) : null}
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
              {isSubmitting ? (
                <svg
                  className="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
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
                </svg>
              ) : null}
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
