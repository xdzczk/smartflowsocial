/**
 * Longform edit page header component
 */

import { Hash } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface LongFormEditHeaderProps {
  displayedHashtags: string;
}

export function LongFormEditHeader({
  displayedHashtags,
}: LongFormEditHeaderProps) {
  return (
    <>
      <h1 className="text-foreground mb-6 text-2xl font-bold dark:text-white">
        Edit Long-form Post
      </h1>

      <Badge variant="secondary" className="mb-6">
        <Hash
          className={`mr-1 inline-block opacity-75 ${INLINE_ICON_SIZE_CLASS}`}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        {displayedHashtags}
      </Badge>
    </>
  );
}
