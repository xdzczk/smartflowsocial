import type { FetcherWithComponents } from "@remix-run/react";
import { useFetcher, useRevalidator } from "@remix-run/react";
import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { queueTypeClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import { useZodForm, formDataToFormData } from "~/lib/validation/utils.client";

import { QUEUE_COLOR_ACCENTS, QUEUE_COLOR_TOKENS } from "../queue-colors";
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

interface QueueTypeDialogFetcherData {
  success?: boolean;
  error?: string;
  queueType?: unknown;
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
  /** When provided, form submit uses this fetcher so parent can read response (e.g. for optimistic list update) */
  formFetcher?: FetcherWithComponents<QueueTypeDialogFetcherData>;
  /** Called with the full fetcher data (includes queueType) so parent can add/update list immediately */
  onQueueCreatedOrUpdated?: (data: QueueTypeDialogFetcherData) => void;
}

export function QueueTypeDialog({
  open,
  onOpenChange,
  queueType,
  hashTagPresets,
  formFetcher: formFetcherProp,
  onQueueCreatedOrUpdated,
}: QueueTypeDialogProps) {
  const internalFetcher = useFetcher<QueueTypeDialogFetcherData>();
  const fetcher = formFetcherProp ?? internalFetcher;
  const revalidator = useRevalidator();
  const lastHandledSuccessRef = useRef<unknown>(null);
  const prevFetcherStateRef = useRef<string>(fetcher.state);
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
  const getDefaultValues = useCallback(() => {
    if (queueType) {
      const scheduleConfig = queueType.scheduleConfig;
      const qt = queueType as QueueType & { colorToken?: string | null };
      const randomWindow =
        scheduleConfig &&
        typeof scheduleConfig === "object" &&
        "scheduleRandomWindowMinutes" in scheduleConfig
          ? ((scheduleConfig as { scheduleRandomWindowMinutes?: number })
              .scheduleRandomWindowMinutes ?? 0)
          : 0;
      return {
        name: queueType.name,
        description: queueType.description ?? "",
        colorToken: qt.colorToken ?? "slate",
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
        scheduleRandomWindowMinutes: randomWindow,
        includeHashtagsInNoteBody:
          (
            queueType as QueueType & {
              includeHashtagsInNoteBody?: boolean;
            }
          ).includeHashtagsInNoteBody !== false,
      };
    }
    return {
      name: "",
      description: "",
      colorToken: "slate" as const,
      hashTagPresetId: "none",
      scheduleType: "INTERVAL" as const,
      isEnabled: false,
      includeHashtagsInNoteBody: true,
      useGlobalInterval: false,
      intervalHours: "",
      slots: "",
      weeklySlots: undefined as
        | Array<{ dayOfWeek: number; time: string }>
        | undefined,
      scheduleRandomWindowMinutes: 0,
    };
  }, [queueType]);

  const defaultFormValues = useMemo(
    () => getDefaultValues() as z.infer<typeof queueTypeClientSchema>,
    [getDefaultValues]
  );

  const form = useZodForm(queueTypeClientSchema, {
    defaultValues: defaultFormValues,
  });

  // Reset form whenever the dialog opens or the edited queue changes, so the
  // modal always shows the correct queue data (or empty for create).
  useEffect(() => {
    if (open) {
      form.reset(defaultFormValues);
    }
  }, [open, defaultFormValues, form]);

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
    const wasLoading =
      prevFetcherStateRef.current === "submitting" ||
      prevFetcherStateRef.current === "loading";
    prevFetcherStateRef.current = fetcher.state;

    const fetcherData = fetcher.data;
    if (
      fetcher.state === "idle" &&
      wasLoading &&
      fetcherData &&
      typeof fetcherData === "object" &&
      !Array.isArray(fetcherData)
    ) {
      const data = fetcherData;
      if (typeof data.success === "boolean" && data.success) {
        if (lastHandledSuccessRef.current !== fetcherData) {
          lastHandledSuccessRef.current = fetcherData;
          if (data.queueType && onQueueCreatedOrUpdated) {
            onQueueCreatedOrUpdated(data);
          }
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
  }, [
    fetcher.state,
    fetcher.data,
    isEditing,
    onOpenChange,
    onQueueCreatedOrUpdated,
    open,
    revalidator,
  ]);

  const onSubmit = form.handleSubmit((data) => {
    // Transform data for FormData submission
    const submitData: Record<string, unknown> = {
      name: data.name,
      description: data.description ?? "",
      colorToken: data.colorToken,
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
      ...(typeof data.scheduleRandomWindowMinutes === "number"
        ? { scheduleRandomWindowMinutes: data.scheduleRandomWindowMinutes }
        : {}),
      includeHashtagsInNoteBody: data.includeHashtagsInNoteBody !== false,
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
            <Label>Queue color</Label>
            <p className="text-muted-foreground text-xs">
              Used to visually identify this queue across the app.
            </p>
            <div
              className="grid grid-cols-6 gap-2"
              role="group"
              aria-label="Queue color"
            >
              {QUEUE_COLOR_TOKENS.map((token) => {
                const isSelected = form.watch("colorToken") === token;
                return (
                  <button
                    key={token}
                    type="button"
                    onClick={() => form.setValue("colorToken", token)}
                    className="focus:ring-ring h-8 w-8 shrink-0 rounded-full border-2 transition-transform focus:ring-2 focus:ring-offset-2 focus:outline-none active:scale-95"
                    style={{
                      backgroundColor: QUEUE_COLOR_ACCENTS[token],
                      borderColor: isSelected ? "var(--ring)" : "transparent",
                      boxShadow: isSelected
                        ? "0 0 0 2px hsl(var(--background))"
                        : undefined,
                    }}
                    title={token}
                    aria-pressed={isSelected}
                  />
                );
              })}
            </div>
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

          <div className="flex items-start gap-2">
            <Checkbox
              id="includeHashtagsInNoteBody"
              className="mt-0.5"
              checked={form.watch("includeHashtagsInNoteBody") === false}
              onCheckedChange={(c) => {
                form.setValue("includeHashtagsInNoteBody", c !== true);
              }}
            />
            <div className="min-w-0 space-y-0.5">
              <Label
                htmlFor="includeHashtagsInNoteBody"
                className="text-sm font-normal"
              >
                Hide tags
              </Label>
              <p className="text-muted-foreground text-xs leading-snug">
                Off by default for new posts in this queue. Turn on to keep
                preset hashtags out of the note text (metadata only).
              </p>
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="scheduleRandomWindowMinutes">
              Post at random time within ± minutes (optional)
            </Label>
            <Select
              value={String(form.watch("scheduleRandomWindowMinutes"))}
              onValueChange={(value) => {
                form.setValue(
                  "scheduleRandomWindowMinutes",
                  Number(value) as 0 | 5 | 10 | 15
                );
              }}
            >
              <SelectTrigger id="scheduleRandomWindowMinutes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off (exact time)</SelectItem>
                <SelectItem value="5">±5 minutes</SelectItem>
                <SelectItem value="10">±10 minutes</SelectItem>
                <SelectItem value="15">±15 minutes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Default when scheduling or using queue mode in the composer. Keeps
              queue slots and intervals from drifting; you can override per post
              in the composer.
            </p>
          </div>

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
                    <X className={INLINE_ICON_SIZE_CLASS} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ dayOfWeek: 1, time: "09:00" })}
              >
                <Plus className={`mr-1 ${INLINE_ICON_SIZE_CLASS}`} />
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
                <Loader2
                  className="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
                  aria-hidden
                />
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
