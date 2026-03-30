/**
 * Shared NIP-88 poll voting + tallies for post detail surfaces.
 */

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import type { SignedEvent } from "~/features/nostr/types";
import { isPollPostItem, parsePollFromSignedEvent } from "~/features/polls";
import type { PollTallyResult } from "~/features/polls/nip88.types";
import { publishPollVote } from "~/features/polls/poll-vote.client";
import { usePollTally } from "~/features/polls/use-poll-tally.client";

import type { Post } from "../data/posts-prisma-types.server";
import type { CombinedContent, PostData } from "../types";

function sumPollCounts(tally: PollTallyResult): number {
  return Object.values(tally.counts).reduce((a, b) => a + b, 0);
}

export type PollVoteLayout = "card" | "inline";

export interface PollVoteBlockProps {
  post: Post | PostData | CombinedContent;
  type: "draft" | "published" | "scheduled";
  nip88PollsEnabled: boolean;
  layout: PollVoteLayout;
  /** When set, replaces the poll question line. */
  questionOverride?: string | null;
  /** When true, omit the question line (e.g. caption above already shows the same text). */
  hideQuestion?: boolean;
}

export function PollVoteBlock({
  post,
  type,
  nip88PollsEnabled,
  layout,
  questionOverride,
  hideQuestion = false,
}: PollVoteBlockProps) {
  const [voting, setVoting] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());

  const pollSigned = post.signedEvent as SignedEvent | undefined | null;
  const isPoll =
    nip88PollsEnabled &&
    (type === "published" || type === "scheduled") &&
    isPollPostItem({
      type: "post",
      postType: "postType" in post ? String(post.postType) : undefined,
      signedEvent: pollSigned ?? undefined,
    });

  const pollDef = useMemo(() => {
    if (!isPoll || !pollSigned) return null;
    return parsePollFromSignedEvent(pollSigned);
  }, [isPoll, pollSigned]);

  const { tally, loading: tallyLoading } = usePollTally(
    pollDef,
    Boolean(pollDef && nip88PollsEnabled)
  );

  if (!isPoll || !pollDef || !pollSigned) return null;

  const pollEvent: SignedEvent = pollSigned;
  const nowSec = Math.floor(Date.now() / 1000);
  const closed = pollDef.endsAt !== undefined && nowSec > pollDef.endsAt;

  async function submitVotes(optionIds: string[]) {
    if (closed || voting || optionIds.length === 0) return;
    setVoting(true);
    try {
      await publishPollVote({ pollSigned: pollEvent, optionIds });
      toast.success("Vote submitted");
      setMultiSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setVoting(false);
    }
  }

  const questionText =
    questionOverride != null && questionOverride !== ""
      ? questionOverride
      : pollDef.question;
  const showQuestionLine = !hideQuestion && Boolean(questionText);

  const optionRowClass =
    layout === "inline"
      ? "flex items-center justify-between gap-2 rounded-lg bg-muted/25 px-3 py-2.5"
      : "flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2";

  const inner = (
    <>
      {showQuestionLine ? (
        <p className="text-foreground mb-3 text-base leading-snug font-medium">
          {questionText}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {pollDef.options.map((opt) => {
          const c = tally?.counts[opt.id] ?? 0;
          const total = tally != null ? sumPollCounts(tally) : 0;
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          const isMulti = pollDef.pollType === "multiplechoice";

          if (isMulti) {
            const checked = multiSelected.has(opt.id);
            return (
              <li key={opt.id} className={optionRowClass}>
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={closed || voting}
                    onCheckedChange={(v) => {
                      setMultiSelected((prev) => {
                        const next = new Set(prev);
                        if (v === true) next.add(opt.id);
                        else next.delete(opt.id);
                        return next;
                      });
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {tallyLoading ? "…" : `${c} (${pct}%)`}
                </span>
              </li>
            );
          }

          return (
            <li key={opt.id}>
              <Button
                type="button"
                variant={layout === "inline" ? "ghost" : "outline"}
                size="sm"
                className="hover:bg-muted/40 h-auto min-h-9 w-full justify-start rounded-lg px-3 py-2 text-left font-normal"
                disabled={closed || voting}
                onClick={() => void submitVotes([opt.id])}
              >
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                <span className="text-muted-foreground ml-2 shrink-0 text-xs tabular-nums">
                  {tallyLoading ? "…" : `${c} (${pct}%)`}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      {pollDef.pollType === "multiplechoice" && !closed ? (
        <Button
          type="button"
          className="mt-3"
          size="sm"
          disabled={voting || multiSelected.size === 0}
          onClick={() => void submitVotes(Array.from(multiSelected))}
        >
          Submit vote
        </Button>
      ) : null}
      {closed ? (
        <p className="text-muted-foreground mt-2 text-xs">Poll closed</p>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          Results load from the poll&apos;s relays (NIP-88).
        </p>
      )}
    </>
  );

  if (layout === "card") {
    return (
      <div className="border-border mt-4 rounded-lg border p-4">
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">Poll</h3>
        {inner}
      </div>
    );
  }

  return <div className="mt-1">{inner}</div>;
}
