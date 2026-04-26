import { cn } from "~/lib/utils";

/** Decorative lane hint for empty queue states (neutral, low contrast). */
export function QueueLanesPreview() {
  const lanes: Array<Array<"empty" | "faint">> = [
    [
      "empty",
      "empty",
      "empty",
      "empty",
      "faint",
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
    ],
    [
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
      "faint",
      "empty",
      "empty",
    ],
    [
      "empty",
      "empty",
      "faint",
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
    ],
  ];

  return (
    <div
      className="border-border-subtle/70 bg-surface-hover/8 dark:bg-surface-hover/6 w-full max-w-[11.5rem] rounded-md border px-2 py-2"
      aria-hidden
    >
      <div className="flex flex-col gap-1.5">
        {/* eslint-disable react/no-array-index-key -- Static decorative preview; fixed grid */}
        {lanes.map((lane, laneIdx) => (
          <div key={laneIdx} className="flex gap-1">
            {lane.map((cell, i) => (
              <div
                key={i}
                className={cn(
                  "border-border-subtle/50 h-1.5 min-w-0 flex-1 rounded-[1px] border",
                  cell === "faint"
                    ? "bg-surface-hover/45 dark:bg-surface-hover/28"
                    : "bg-transparent"
                )}
              />
            ))}
          </div>
        ))}
        {/* eslint-enable react/no-array-index-key */}
      </div>
    </div>
  );
}
