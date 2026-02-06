import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

export interface AssetListCardAsset {
  id: string;
  assetType: string;
  fileUrl?: string;
  content?: string | null;
  title?: string | null;
  tags?: string[];
  createdAt: string | Date;
}

export interface AssetListCardProps {
  asset: AssetListCardAsset;
  selected: boolean;
  onSelect: (assetId: string) => void;
  deleteFetcherForm: React.ComponentType<{
    children: React.ReactNode;
    method: string;
    className?: string;
  }>;
  onDeleteAsset: (
    e: React.MouseEvent<HTMLButtonElement>,
    assetId: string
  ) => void;
  deleteFetcherState: "idle" | "submitting" | "loading";
}

export function AssetListCard({
  asset,
  selected,
  onSelect,
  deleteFetcherForm: DeleteFetcherForm,
  onDeleteAsset,
  deleteFetcherState,
}: AssetListCardProps) {
  const { formatDate } = useFormattedDate();
  const contentSnippet =
    asset.assetType === "TEXT" && asset.content
      ? asset.content.length > 50
        ? asset.content.slice(0, 50) + "…"
        : asset.content
      : null;
  const tags = asset.tags?.slice(0, 3) ?? [];

  return (
    <div className="border-border bg-card hover:bg-muted/50 flex cursor-pointer items-stretch gap-3 rounded-lg border p-3 text-left shadow-sm transition-colors">
      <div
        className="flex flex-shrink-0 items-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
          }
        }}
        role="none"
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(asset.id)}
          className="border-border accent-checkbox focus:ring-ring h-4 w-4 rounded"
        />
      </div>
      <div className="flex h-14 w-14 flex-shrink-0 overflow-hidden rounded-md">
        {asset.assetType === "IMAGE" || asset.assetType === "VIDEO" ? (
          <MediaThumbnail
            src={asset.fileUrl ?? ""}
            alt={asset.title ?? "Asset"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
            TEXT
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{asset.title ?? "Untitled"}</p>
        {contentSnippet ? (
          <p className="text-muted-foreground truncate text-xs">
            {contentSnippet}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">
            {formatDate(asset.createdAt)}
          </span>
          {tags.length > 0
            ? tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted text-foreground inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                >
                  {tag}
                </span>
              ))
            : null}
          {asset.tags && asset.tags.length > 3 ? (
            <span className="text-muted-foreground text-[10px]">
              +{asset.tags.length - 3}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex-shrink-0">
        <DeleteFetcherForm method="post" className="inline">
          <input type="hidden" name="_action" value="delete_asset" />
          <input type="hidden" name="assetId" value={asset.id} />
          <button
            type="submit"
            onClick={(e) => onDeleteAsset(e, asset.id)}
            disabled={deleteFetcherState !== "idle"}
            className="text-destructive hover:bg-muted rounded-md px-2 py-1 text-sm font-medium disabled:opacity-50"
          >
            Delete
          </button>
        </DeleteFetcherForm>
      </div>
    </div>
  );
}
