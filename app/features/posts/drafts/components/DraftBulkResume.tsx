import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  requestNewSignerSession,
  tryBackgroundReconnect,
} from "~/features/auth/signer";
import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";
import {
  getQueueAccentHex,
  getSelectedQueueStyle,
} from "~/features/posts/queue-colors";
import type { QueueType, PostData } from "~/features/posts/types";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import { useDraftBulkResumeState } from "../hooks/useDraftBulkResumeState";

interface DraftBulkResumeProps {
  selectedDrafts: PostData[];
  queueTypes: QueueType[];
  onCancel: () => void;
}

function getImageUrls(fileUrl: string[] | null | undefined): string[] {
  if (!fileUrl || fileUrl.length === 0) return [];
  if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
    try {
      return JSON.parse(fileUrl[0]) as string[];
    } catch {
      return [];
    }
  }
  return fileUrl;
}

export default function DraftBulkResume({
  selectedDrafts,
  queueTypes,
  onCancel,
}: DraftBulkResumeProps) {
  const {
    posts,
    isSubmitting,
    signingError,
    handlers,
    user,
    scheduleIntervals,
  } = useDraftBulkResumeState({ selectedDrafts, queueTypes, onCancel });

  useComposerSignerReconnect(
    handlers.cancelSigningState,
    isSubmitting,
    handlers.retryLastSign
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-3xl font-bold dark:text-white">
            Resume Draft Posts
          </h1>
          <p className="text-foreground dark:text-foreground mt-2">
            Configure and sign {posts.length} draft posts before scheduling
          </p>
        </div>
        {isSubmitting ? (
          <div className="bg-muted/50 dark:bg-muted/20 mx-auto mb-6 max-w-3xl rounded-lg border p-4 text-center">
            <p className="text-foreground dark:text-foreground mb-3 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Signing draft posts...
            </p>
            <span className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  void requestNewSignerSession(handlers.cancelSigningState)
                }
              >
                Use new session
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  handlers.cancelSigningState();
                  void tryBackgroundReconnect();
                }}
              >
                Cancel
              </Button>
            </span>
          </div>
        ) : null}
        {signingError ? (
          <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive mx-auto mb-4 max-w-3xl rounded-md border p-3 text-sm">
            {signingError}
          </div>
        ) : null}

        {/* Schedule Interval Buttons */}
        {posts.length > 0 ? (
          <div className="mt-4 mb-4 flex justify-center">
            {scheduleIntervals
              ? scheduleIntervals.map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() =>
                      handlers.handleScheduleIntervalClick(
                        typeof interval === "string"
                          ? Number(interval)
                          : interval
                      )
                    }
                    disabled={isSubmitting}
                    className="dark:bg-card bg-muted text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-muted mx-2 rounded-md px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {formatIntervalLabel(
                      typeof interval === "string"
                        ? Number(interval)
                        : interval,
                      { compact: true }
                    )}
                  </button>
                ))
              : null}
          </div>
        ) : null}

        {/* Bulk Queue Selection */}
        {posts.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-muted-foreground dark:text-foreground mb-3 text-sm font-medium">
              Bulk Queue Selection
            </h3>
            <div className="flex flex-wrap justify-center gap-2">
              {queueTypes
                .filter((q) => {
                  const name = typeof q === "string" ? q : q.name;
                  return name !== "Unassigned";
                })
                .map((queue) => {
                  const queueName =
                    typeof queue === "string" ? queue : queue.name;
                  const colorToken =
                    typeof queue === "object"
                      ? (queue as { colorToken?: string | null }).colorToken
                      : null;
                  const isAllSelected =
                    posts.length > 0 &&
                    posts.every((p) => p.queueType === queueName);
                  const accent =
                    colorToken != null
                      ? getQueueAccentHex(colorToken)
                      : undefined;
                  return (
                    <button
                      key={queueName}
                      type="button"
                      onClick={() =>
                        void handlers.handleBulkQueueUpdate(
                          isAllSelected ? "unassigned" : queueName
                        )
                      }
                      disabled={isSubmitting}
                      className={`rounded-md border-2 px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${getSelectedQueueStyle(colorToken ?? queueName, isAllSelected)}`}
                      style={{
                        backgroundColor: accent,
                        borderColor: accent,
                      }}
                      title={
                        isAllSelected
                          ? "Click again to leave all unassigned"
                          : "Assign this queue to all posts"
                      }
                    >
                      {queueName}
                    </button>
                  );
                })}
            </div>
            <p className="text-muted-foreground dark:text-foreground mt-2 text-center text-xs">
              Click a queue to assign; click again to leave all unassigned
            </p>
          </div>
        ) : null}

        {/* Posts Configuration Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left">Media</th>
                <th className="p-4 text-left">Content</th>
                <th className="p-4 text-left">Queue</th>
                <th className="p-4 text-left">Hide tags</th>
                <th className="p-4 text-left">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr key={post.id} className="border-b">
                  <td className="p-4">
                    {post.fileUrl.length > 0 ? (
                      <img
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Preview"
                        className="h-24 w-24 rounded object-cover"
                      />
                    ) : (
                      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-muted-foreground flex h-24 w-24 items-center justify-center rounded text-xs font-medium">
                        TEXT
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="max-h-20 overflow-y-auto">
                      <p className="text-muted-foreground dark:text-foreground text-sm">
                        {post.content?.substring(0, 150) ?? ""}
                        {(post.content?.length ?? 0) > 150 ? "..." : null}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {queueTypes
                        .filter((q) => {
                          const name = typeof q === "string" ? q : q.name;
                          return name !== "Unassigned";
                        })
                        .map((queue) => {
                          const queueName =
                            typeof queue === "string" ? queue : queue.name;
                          const colorToken =
                            typeof queue === "object"
                              ? (queue as { colorToken?: string | null })
                                  .colorToken
                              : null;
                          const isSelected = post.queueType === queueName;
                          const accent =
                            colorToken != null
                              ? getQueueAccentHex(colorToken)
                              : undefined;
                          return (
                            <button
                              key={queueName}
                              type="button"
                              onClick={() => {
                                void handlers.handleQueueTypeChange(
                                  index,
                                  isSelected ? "unassigned" : queueName
                                );
                              }}
                              disabled={isSubmitting}
                              className={`rounded-md border-2 px-3 py-1 text-xs font-medium transition-all duration-200 ${getSelectedQueueStyle(colorToken ?? queueName, isSelected)}`}
                              style={{
                                backgroundColor: accent,
                                borderColor: accent,
                              }}
                              title={
                                isSelected
                                  ? "Click again to leave unassigned"
                                  : undefined
                              }
                            >
                              {queueName}
                            </button>
                          );
                        })}
                    </div>
                  </td>
                  <td className="p-4">
                    <label
                      htmlFor={`draft-bulk-tags-in-note-${post.id}`}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`draft-bulk-tags-in-note-${post.id}`}
                        checked={post.includeHashtagsInNoteBody === false}
                        onCheckedChange={(c) =>
                          handlers.handleIncludeHashtagsInNoteBodyChange(
                            index,
                            c !== true
                          )
                        }
                        disabled={isSubmitting}
                      />
                      <span className="text-muted-foreground dark:text-foreground">
                        Hide tags
                      </span>
                    </label>
                  </td>
                  <td className="p-4">
                    <input
                      type="datetime-local"
                      value={post.scheduledFor}
                      onChange={(e) =>
                        handlers.handleDateChange(index, e.target.value)
                      }
                      min={getNowForDateTimeLocal(user?.timezone ?? "UTC")}
                      disabled={isSubmitting}
                      className="dark:bg-card text-foreground dark:text-foreground rounded-lg border p-2"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="dark:bg-card border-border text-muted-foreground hover:bg-muted dark:border-border dark:text-foreground dark:hover:bg-muted rounded-lg border bg-white px-6 py-3 text-sm font-medium shadow-sm transition-all hover:shadow-md"
          >
            Cancel
          </button>
          <button
            onClick={() => void handlers.handleSignAndResume()}
            disabled={isSubmitting}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-8 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-300 disabled:to-green-400"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing & Scheduling...
              </span>
            ) : (
              `Sign & Schedule ${posts.length} Posts`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
