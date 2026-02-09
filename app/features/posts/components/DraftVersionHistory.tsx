import { Form } from "@remix-run/react";
import { History } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export interface DraftVersionItem {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string | null;
}

interface DraftVersionHistoryProps {
  versions: DraftVersionItem[];
  /** Route path to submit restore (e.g. current page). */
  actionUrl: string;
  disabled?: boolean;
}

function formatVersionDate(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "Unknown";
  }
}

export function DraftVersionHistory({
  versions,
  actionUrl,
  disabled = false,
}: DraftVersionHistoryProps) {
  if (versions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <History className="h-4 w-4" aria-hidden />
          Version history ({versions.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[280px] overflow-y-auto"
      >
        {versions.map((v) => (
          <DropdownMenuItem key={v.id} asChild>
            <Form
              method="post"
              action={actionUrl}
              className="flex w-full items-center justify-between gap-2"
            >
              <input type="hidden" name="_action" value="restore-version" />
              <input type="hidden" name="versionId" value={v.id} />
              <span className="truncate text-left">
                v{v.version} · {formatVersionDate(v.createdAt)}
              </span>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="shrink-0"
              >
                Restore
              </Button>
            </Form>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
