import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";

import { contestCopy } from "../contest-copy";

export function ContestShareActions({
  announcementText,
  updateText,
}: {
  announcementText: string;
  updateText: string;
}) {
  const [copiedKey, setCopiedKey] = useState<"announcement" | "update" | null>(
    null
  );

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(announcementText);
          setCopiedKey("announcement");
        }}
      >
        {copiedKey === "announcement" ? "Copied" : contestCopy.copyAnnouncement}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(updateText);
          setCopiedKey("update");
        }}
      >
        {copiedKey === "update" ? "Copied" : contestCopy.copyUpdate}
      </Button>
    </div>
  );
}
