import { contestCopy } from "../contest-copy";

export function ContestShareActions({
  announcementText,
  updateText,
}: {
  announcementText: string;
  updateText: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="border-border bg-background hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
        onClick={() => void navigator.clipboard.writeText(announcementText)}
      >
        {contestCopy.copyAnnouncement}
      </button>
      <button
        type="button"
        className="border-border bg-background hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
        onClick={() => void navigator.clipboard.writeText(updateText)}
      >
        {contestCopy.copyUpdate}
      </button>
    </div>
  );
}
