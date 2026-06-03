import type { FetcherWithComponents } from "@remix-run/react";
import { useFetcher, useRevalidator } from "@remix-run/react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "react-hot-toast";
import type { z } from "zod";

import { Button } from "~/components/ui/button";
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
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { BRAND_NAME } from "~/lib/brand";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { queueTypeClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

import { QUEUE_COLOR_ACCENTS, QUEUE_COLOR_TOKENS } from "../queue-colors";
import type { QueueType } from "../types";
import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";

interface QueueTypeDialogQueueType extends QueueType {
  hashTagPreset?: {
    id: string;
    name: string;
    tags: string;
    description?: string | null;
  } | null;
  hashTagPresetId?: string | null;
}

function readScheduleRandomWindowMinutes(
  scheduleConfig: QueueType["scheduleConfig"]
): number {
  if (
    scheduleConfig &&
    typeof scheduleConfig === "object" &&
    "scheduleRandomWindowMinutes" in scheduleConfig
  ) {
    return (
      (scheduleConfig as { scheduleRandomWindowMinutes?: number })
        .scheduleRandomWindowMinutes ?? 0
    );
  }
  return 0;
}

function intervalHoursFieldFromSchedule(
  scheduleConfig: QueueType["scheduleConfig"]
): string {
  return scheduleConfig && isIntervalScheduleConfig(scheduleConfig)
    ? (scheduleConfig.intervalHours?.toString() ?? "")
    : "";
}

function slotsFieldFromSchedule(
  scheduleConfig: QueueType["scheduleConfig"]
): string {
  return scheduleConfig && isFixedSlotsScheduleConfig(scheduleConfig)
    ? scheduleConfig.slots.join(", ")
    : "";
}

function weeklySlotsFieldFromSchedule(
  scheduleConfig: QueueType["scheduleConfig"]
): Array<{ dayOfWeek: number; time: string }> | undefined {
  return scheduleConfig && isWeeklySlotsScheduleConfig(scheduleConfig)
    ? scheduleConfig.weeklySlots
    : undefined;
}

type QueueTypeFormValues = z.infer<typeof queueTypeClientSchema>;

const QUEUE_DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function QueueTypeDialogScheduleAndTimingSections({
  form,
  scheduleType,
  hasLegacyGlobalInterval,
  fields,
  append,
  remove,
}: {
  form: UseFormReturn<QueueTypeFormValues>;
  scheduleType: QueueTypeFormValues["scheduleType"];
  hasLegacyGlobalInterval: boolean;
  fields: Array<{ id: string }>;
  append: (value: { dayOfWeek: number; time: string }) => void;
  remove: (index: number) => void;
}) {
  return (
    <>
      <Separator />

      <section className="space-y-3">
        <h3 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
          Schedule logic
        </h3>
        <div className="space-y-2">
          <Label htmlFor="scheduleType">Schedule type</Label>
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
                form.setValue("weeklySlots", [{ dayOfWeek: 1, time: "09:00" }]);
              }
            }}
          >
            <SelectTrigger id="scheduleType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERVAL">Interval</SelectItem>
              <SelectItem value="FIXED_SLOTS">Fixed slots</SelectItem>
              <SelectItem value="WEEKLY_SLOTS">Weekly slots</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scheduleType === "INTERVAL" ? (
          <div className="space-y-3">
            {hasLegacyGlobalInterval ? (
              <p className="text-text-secondary text-xs leading-relaxed">
                This queue previously used a global schedule setting. Set a
                custom interval to continue editing it.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="intervalHours">Hours between posts</Label>
              <Input
                id="intervalHours"
                type="number"
                min="1"
                max="168"
                step="1"
                {...form.register("intervalHours")}
              />
              {form.formState.errors.intervalHours ? (
                <p className="text-danger text-sm">
                  {form.formState.errors.intervalHours.message}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {scheduleType === "FIXED_SLOTS" ? (
          <div className="space-y-2">
            <Label htmlFor="slots">Times (HH:MM, comma-separated)</Label>
            <Input
              id="slots"
              {...form.register("slots")}
              placeholder="08:00, 12:00, 18:00"
            />
            {form.formState.errors.slots ? (
              <p className="text-danger text-sm">
                {form.formState.errors.slots.message}
              </p>
            ) : null}
            <p className="text-text-secondary text-xs">
              In your timezone from General settings.
            </p>
          </div>
        ) : null}

        {scheduleType === "WEEKLY_SLOTS" ? (
          <div className="space-y-2">
            <Label>Weekly slots</Label>
            <p className="text-text-secondary text-xs">
              Day and time pairs in your timezone.
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
                    form.setValue(`weeklySlots.${index}.dayOfWeek`, Number(val))
                  }
                >
                  <SelectTrigger className="w-[140px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUEUE_DAY_LABELS.map((label, i) => (
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
              <p className="text-danger text-sm">
                {form.formState.errors.weeklySlots.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
          Timing behavior
        </h3>
        <div className="space-y-2">
          <Label htmlFor="scheduleRandomWindowMinutes">
            Randomize slot time (± minutes)
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
          <p className="text-text-secondary text-xs">
            Applies when scheduling or using queue mode; optional jitter so
            posts do not land on identical timestamps.
          </p>
        </div>
      </section>
    </>
  );
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
  /**
   * POST target for create/update (defaults to current route).
   * Use `/dashboard/settings` when embedding the dialog on another page so queue actions hit the settings handler.
   */
  submitAction?: string;
}

export function QueueTypeDialog({
  open,
  onOpenChange,
  queueType,
  hashTagPresets,
  formFetcher: formFetcherProp,
  onQueueCreatedOrUpdated,
  submitAction,
}: QueueTypeDialogProps) {
  const internalFetcher = useFetcher<QueueTypeDialogFetcherData>();
  const fetcher = formFetcherProp ?? internalFetcher;
  const revalidator = useRevalidator();
  const lastHandledSuccessRef = useRef<unknown>(null);
  const prevFetcherStateRef = useRef<string>(fetcher.state);
  const isEditing = !!queueType;

  // Initialize form with default values
  const getDefaultValues = useCallback(() => {
    if (queueType) {
      const scheduleConfig = queueType.scheduleConfig;
      const qt = queueType as QueueType & { colorToken?: string | null };
      return {
        name: queueType.name,
        description: queueType.description ?? "",
        colorToken: qt.colorToken ?? "slate",
        hashTagPresetId: queueType.hashTagPresetId ?? "none",
        scheduleType: queueType.scheduleType ?? "INTERVAL",
        isEnabled: queueType.isEnabled !== false,
        // Legacy support: queues may have been created with useGlobalInterval. We no longer expose this option.
        useGlobalInterval: false,
        intervalHours: intervalHoursFieldFromSchedule(scheduleConfig),
        slots: slotsFieldFromSchedule(scheduleConfig),
        weeklySlots: weeklySlotsFieldFromSchedule(scheduleConfig),
        scheduleRandomWindowMinutes:
          readScheduleRandomWindowMinutes(scheduleConfig),
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
      isEnabled: true,
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
  const hasLegacyGlobalInterval =
    queueType?.scheduleType === "INTERVAL" &&
    isIntervalScheduleConfig(queueType.scheduleConfig) &&
    queueType.scheduleConfig.useGlobalInterval === true;

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
      // Always submit false; UI no longer supports global interval mode.
      useGlobalInterval: false,
      ...(data.intervalHours ? { intervalHours: data.intervalHours } : {}),
      ...(data.slots ? { slots: data.slots } : {}),
      ...(data.scheduleType === "WEEKLY_SLOTS" && data.weeklySlots?.length
        ? { weeklySlots: JSON.stringify(data.weeklySlots) }
        : {}),
      ...(typeof data.scheduleRandomWindowMinutes === "number"
        ? { scheduleRandomWindowMinutes: data.scheduleRandomWindowMinutes }
        : {}),
      // Send an explicit string: formDataToFormData drops `false` booleans, which
      // would make the server default this back to true (losing "metadata only").
      includeHashtagsInNoteBody:
        data.includeHashtagsInNoteBody !== false ? "true" : "false",
    };

    const formData = formDataToFormData(
      submitData,
      isEditing ? "update_queue_type" : "create_queue_type"
    );

    if (isEditing) {
      formData.set("id", queueType.id);
    }

    fetcher.submit(
      formData,
      submitAction
        ? { method: "post", action: submitAction }
        : { method: "post" }
    );
  });

  const includeInNote = form.watch("includeHashtagsInNoteBody") !== false;
  const isEnabledValue = form.watch("isEnabled") !== false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-lg"
        onOpenAutoFocus={isEditing ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 pr-6">
          <DialogTitle>{isEditing ? "Edit queue" : "Create queue"}</DialogTitle>
          <DialogDescription>
            Set how this queue schedules posts, hashtag defaults, and timing.
          </DialogDescription>
        </DialogHeader>

        <form
          id="queue-type-dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 pb-2">
            <section className="space-y-3">
              <h3 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
                Basic info
              </h3>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="e.g., Morning thread"
                />
                {form.formState.errors.name ? (
                  <p className="text-danger text-sm">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...form.register("description")}
                  placeholder="Optional  -  when to use this queue"
                />
              </div>
              <div className="space-y-2">
                <Label>Queue color</Label>
                <p className="text-text-secondary text-xs">
                  Identifies this queue in calendars and pickers.
                </p>
                <div
                  className="grid grid-cols-6 gap-2 sm:grid-cols-8"
                  role="group"
                  aria-label="Queue color"
                >
                  {QUEUE_COLOR_TOKENS.map((token) => {
                    const isSelected = form.watch("colorToken") === token;
                    const accent = QUEUE_COLOR_ACCENTS[token];
                    return (
                      <button
                        key={token}
                        type="button"
                        onClick={() => form.setValue("colorToken", token)}
                        className="focus-ring-offset relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent transition-transform active:scale-95"
                        style={{
                          backgroundColor: accent,
                          boxShadow: isSelected
                            ? "0 0 0 1px hsl(var(--canvas)), 0 0 0 2px hsl(var(--border))"
                            : undefined,
                        }}
                        title={token}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? (
                          <Check
                            className="pointer-events-none h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
                            strokeWidth={2.75}
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
                Publishing defaults
              </h3>
              <div className="space-y-2">
                <Label htmlFor="hashTagPresetId">Hashtag preset</Label>
                <Select
                  value={hashTagPresetId ?? "none"}
                  onValueChange={(value) => {
                    form.setValue("hashTagPresetId", value);
                  }}
                >
                  <SelectTrigger id="hashTagPresetId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preset</SelectItem>
                    {hashTagPresets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-text-secondary text-xs">
                  New posts in this queue can start from this preset. Queues and
                  presets work together across {BRAND_NAME}.
                </p>
              </div>

              <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <Label
                    htmlFor="metadata-only-hashtags"
                    className="text-sm font-medium"
                  >
                    Keep preset hashtags in metadata only
                  </Label>
                  <p className="text-text-secondary text-xs leading-snug">
                    When on, preset tags are not appended to the note text by
                    default (you can still change per post).
                  </p>
                </div>
                <Switch
                  id="metadata-only-hashtags"
                  checked={!includeInNote}
                  onCheckedChange={(checked) => {
                    form.setValue("includeHashtagsInNoteBody", !checked);
                  }}
                  className="shrink-0"
                />
              </div>

              <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <Label
                    htmlFor="queue-enabled"
                    className="text-sm font-medium"
                  >
                    Enabled
                  </Label>
                  <p className="text-text-secondary text-xs leading-snug">
                    Disabled queues stay in settings but cannot be selected for
                    new posts.
                  </p>
                </div>
                <Switch
                  id="queue-enabled"
                  checked={isEnabledValue}
                  onCheckedChange={(checked) => {
                    form.setValue("isEnabled", checked);
                  }}
                  className="shrink-0"
                />
              </div>
            </section>

            <QueueTypeDialogScheduleAndTimingSections
              form={form as UseFormReturn<QueueTypeFormValues>}
              scheduleType={scheduleType}
              hasLegacyGlobalInterval={hasLegacyGlobalInterval}
              fields={fields}
              append={append}
              remove={remove}
            />
          </div>
        </form>

        <DialogFooter className="border-border/60 mt-2 shrink-0 gap-2 border-t pt-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="queue-type-dialog-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2
                className="text-brand-on mr-2 -ml-1 h-4 w-4 animate-spin"
                aria-hidden
              />
            ) : null}
            {isSubmitting
              ? isEditing
                ? "Saving…"
                : "Creating…"
              : isEditing
                ? "Save changes"
                : "Create queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
