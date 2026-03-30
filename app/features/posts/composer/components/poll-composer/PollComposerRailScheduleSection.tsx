import type { PublishingSummarySection } from "~/features/posts/components/ConfidencePanel";
import {
  ComposerQueueField,
  ComposerScheduleField,
  ComposerScheduleRandomWindowField,
  getQueueNextSlotLabel,
  type ComposerPublishMode,
} from "~/features/posts/composer/components/composer";
import type { QueueType } from "~/features/posts/types";

const POLL_QUEUE_SCHEDULE_RANDOM_WINDOW_OPTIONS = [5, 10, 15] as const;

export interface PollComposerRailScheduleSectionInput {
  publishMode: ComposerPublishMode;
  disabled: boolean;
  queueTypes: Array<string | QueueType>;
  selectedQueue: string;
  handlePollQueueChange: (queueName: string) => void;
  selectedQueueType: string | QueueType | undefined;
  scheduledFor: string;
  setScheduledFor: (v: string) => void;
  scheduleIntervals: number[];
  handleScheduleIntervalClick: (intervalHours: string | number) => void;
  calculateQueueScheduleTime: (queueName: string) => Promise<string | null>;
  scheduleRandomWindowMinutes: number;
  setScheduleRandomWindowMinutes: (v: number) => void;
  userTimezone: string;
  pollQueueNextSlotLabel: string | undefined;
}

export function getPollComposerModeSpecificSection(
  input: PollComposerRailScheduleSectionInput
): PublishingSummarySection | undefined {
  const {
    publishMode,
    disabled,
    queueTypes,
    selectedQueue,
    handlePollQueueChange,
    selectedQueueType,
    scheduledFor,
    setScheduledFor,
    scheduleIntervals,
    handleScheduleIntervalClick,
    calculateQueueScheduleTime,
    scheduleRandomWindowMinutes,
    setScheduleRandomWindowMinutes,
    userTimezone,
    pollQueueNextSlotLabel,
  } = input;

  if (publishMode === "now") return undefined;

  return {
    lines:
      publishMode === "queue"
        ? [
            ...(selectedQueueType &&
            typeof selectedQueueType === "object" &&
            (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
              selectedQueueType.scheduleType === "WEEKLY_SLOTS") &&
            pollQueueNextSlotLabel
              ? [`Next slot (estimate): ${pollQueueNextSlotLabel}`]
              : []),
          ]
        : [],
    controls:
      publishMode === "queue" ? (
        <div className="space-y-3">
          <ComposerQueueField
            queueTypes={queueTypes}
            value={selectedQueue}
            onChange={handlePollQueueChange}
            disabled={disabled}
            nextSlot={
              selectedQueueType &&
              typeof selectedQueueType === "object" &&
              (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                selectedQueueType.scheduleType === "WEEKLY_SLOTS")
                ? getQueueNextSlotLabel(scheduledFor)
                : undefined
            }
          />
          {selectedQueue !== "unassigned" ? (
            <ComposerScheduleRandomWindowField
              scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
              onScheduleRandomWindowMinutesChange={
                setScheduleRandomWindowMinutes
              }
              disabled={disabled}
              windowOptions={POLL_QUEUE_SCHEDULE_RANDOM_WINDOW_OPTIONS}
              label="Randomize within queue slot"
              idPrefix="poll-queue-schedule-randomize"
              description="Optional jitter around the next slot time. Queue settings load a default; change here for this post only."
            />
          ) : null}
        </div>
      ) : (
        <ComposerScheduleField
          layout="full"
          value={scheduledFor}
          onValueChange={setScheduledFor}
          scheduleIntervals={scheduleIntervals}
          queueTypes={queueTypes}
          selectedQueue={selectedQueue}
          onScheduleIntervalClick={handleScheduleIntervalClick}
          onCalculateNextSlot={() => {
            const run = calculateQueueScheduleTime(selectedQueue);
            void run;
          }}
          scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
          onScheduleRandomWindowMinutesChange={setScheduleRandomWindowMinutes}
          postOptionsOpen={false}
          onPostOptionsOpenChange={() => void 0}
          isThreadMode={false}
          onThreadModeChange={() => void 0}
          disabled={disabled}
          userTimezone={userTimezone}
          showThreadModeToggle={false}
        />
      ),
  };
}
