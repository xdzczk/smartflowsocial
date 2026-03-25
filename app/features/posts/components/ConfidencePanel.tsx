/**
 * Confidence panel: where / when / what / how.
 * Desktop: right rail. Mobile: collapsible Details drawer.
 */

import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

interface ConfidencePanelProps {
  /** Queue name */
  queueName: string;
  /** Next eligible slot (if slot-based queue) */
  nextSlot?: string;
  /** Scheduled datetime string (datetime-local or formatted) */
  scheduledFor?: string;
  /** User timezone label */
  timezone?: string;
  /** Relative time e.g. "in 2h 14m" */
  relativeTime?: string;
  /** Character count */
  charCount: number;
  /** Attachment count */
  attachmentCount: number;
  /** Signer type e.g. "NIP-07 extension" / "NIP-46 (Bunker)" */
  signerType?: string;
  /** Number of relays */
  relayCount: number;
  /** Optional summary line e.g. "Will publish Sat 18:30 (Europe/Riga) to Great Queue" */
  summaryLine?: string;
  /** When in thread mode e.g. "3 segments · every 2 min" */
  threadSummary?: string;
  /** Warnings to show e.g. "Unassigned queue + schedule may not run as expected" */
  warnings?: string[];
  /** When slot-based queue: show "Uses next queue slot" under When */
  usesQueueSlot?: boolean;
  /** Content for desktop: always visible when not in sheet */
  children?: React.ReactNode;
}

function PanelContent({
  queueName,
  nextSlot,
  scheduledFor,
  timezone,
  relativeTime,
  charCount,
  attachmentCount,
  signerType,
  relayCount,
  summaryLine,
  threadSummary,
  warnings,
  usesQueueSlot,
}: Omit<ConfidencePanelProps, "children">) {
  return (
    <div className="space-y-3 text-sm">
      {warnings && warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-500/10 p-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}
      {summaryLine ? (
        <p className="text-muted-foreground border-border border-b pb-2 text-xs">
          {summaryLine}
        </p>
      ) : null}
      <div className="bg-muted/10 rounded-md p-2">
        <span className="text-muted-foreground font-medium">Where</span>
        <p className="mt-0.5">
          {queueName === "unassigned" ? "No queue" : queueName}
        </p>
        {nextSlot ? (
          <p className="text-muted-foreground text-xs">Next: {nextSlot}</p>
        ) : null}
      </div>
      <div className="bg-muted/10 rounded-md p-2">
        <span className="text-muted-foreground font-medium">When</span>
        {scheduledFor ? (
          <>
            <p className="mt-0.5">{scheduledFor}</p>
            {timezone ? (
              <p className="text-muted-foreground text-xs">{timezone}</p>
            ) : null}
            {relativeTime ? (
              <p className="text-muted-foreground text-xs">{relativeTime}</p>
            ) : null}
            {usesQueueSlot ? (
              <p className="text-muted-foreground text-xs">
                Uses next queue slot.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground mt-0.5">Publish now</p>
        )}
      </div>
      <div className="bg-muted/10 rounded-md p-2">
        <span className="text-muted-foreground font-medium">What</span>
        <p className="mt-0.5">
          {charCount} chars · {attachmentCount} attachment
          {attachmentCount !== 1 ? "s" : ""}
        </p>
        {threadSummary ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Thread: {threadSummary}
          </p>
        ) : null}
      </div>
      <div className="bg-muted/10 rounded-md p-2">
        <span className="text-muted-foreground font-medium">How</span>
        <p className="mt-0.5">{signerType ?? "Signer"}</p>
        <p className="text-muted-foreground text-xs">
          {relayCount} relay{relayCount !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

export function ConfidencePanel({
  queueName,
  nextSlot,
  scheduledFor,
  timezone,
  relativeTime,
  charCount,
  attachmentCount,
  signerType,
  relayCount,
  summaryLine,
  threadSummary,
  warnings,
  usesQueueSlot,
  children,
}: ConfidencePanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Desktop: right rail — sticky on aside + flex parent items-start so it pins while scrolling the composer */}
      <aside
        className="border-border bg-card hidden h-fit w-64 shrink-0 self-start rounded-lg border-2 p-4 shadow-md lg:sticky lg:top-20 lg:block"
        aria-label="Composer details"
      >
        <div className="space-y-3">
          <h3 className="text-foreground text-xs font-semibold tracking-wider uppercase">
            Execution summary
          </h3>
          <PanelContent
            queueName={queueName}
            nextSlot={nextSlot}
            scheduledFor={scheduledFor}
            timezone={timezone}
            relativeTime={relativeTime}
            charCount={charCount}
            attachmentCount={attachmentCount}
            signerType={signerType}
            relayCount={relayCount}
            summaryLine={summaryLine}
            threadSummary={threadSummary}
            warnings={warnings}
            usesQueueSlot={usesQueueSlot}
          />
          {children}
        </div>
      </aside>

      {/* Mobile: collapsible sheet */}
      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Execution summary
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>Execution summary</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <PanelContent
                queueName={queueName}
                nextSlot={nextSlot}
                scheduledFor={scheduledFor}
                timezone={timezone}
                relativeTime={relativeTime}
                charCount={charCount}
                attachmentCount={attachmentCount}
                signerType={signerType}
                relayCount={relayCount}
                summaryLine={summaryLine}
                threadSummary={threadSummary}
                warnings={warnings}
                usesQueueSlot={usesQueueSlot}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
