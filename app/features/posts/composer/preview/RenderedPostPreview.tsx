import { Badge } from "~/components/ui/badge";
import type { User } from "~/features/user";

import type { NormalizedPostPreview } from "./normalized-composer-preview.types";
import { PreviewAccountHeader } from "./PreviewAccountHeader";
import { PreviewNoteBody } from "./PreviewNoteBody";
import { PreviewPostMediaGrid } from "./PreviewPostMediaGrid";

export function RenderedPostPreview({
  data,
  user,
}: {
  data: NormalizedPostPreview;
  user: User | undefined;
}) {
  return (
    <article>
      <PreviewAccountHeader user={user} />
      <PreviewNoteBody text={data.text} />
      <PreviewPostMediaGrid
        media={data.media}
        className={data.text.trim() ? "mt-2.5" : undefined}
      />
      {data.hideTags ? (
        data.tags.length > 0 ? (
          <p className="text-text-tertiary mt-2.5 text-xs">
            {data.tags.length} hidden topic tag
            {data.tags.length === 1 ? "" : "s"} included
          </p>
        ) : null
      ) : data.tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs font-normal">
              #{t}
            </Badge>
          ))}
        </div>
      ) : null}
    </article>
  );
}
