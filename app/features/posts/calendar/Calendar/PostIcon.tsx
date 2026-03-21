import {
  AlignLeft,
  BarChart3,
  FileText,
  Image,
  Repeat,
  Video,
} from "lucide-react";

import { isPollPostItem } from "~/features/polls";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import type { CalendarPost } from "./PostBlock.types";
interface PostIconProps {
  post: CalendarPost;
  isLongform: boolean;
  className?: string;
}

export function PostIcon({
  post,
  isLongform,
  className = "h-3 w-3",
}: PostIconProps) {
  const stroke = INLINE_ICON_STROKE;
  if (isLongform) {
    return <FileText className={className} strokeWidth={stroke} aria-hidden />;
  }

  if (
    isPollPostItem({
      type: "post",
      postType: post.postType,
      signedEvent: post.signedEvent ?? undefined,
    })
  ) {
    return <BarChart3 className={className} strokeWidth={stroke} aria-hidden />;
  }

  // Reposts: use Repeat (two arrows in a circle) as primary icon
  if (post.repost === true || post.postKind === "REPOST") {
    return <Repeat className={className} strokeWidth={stroke} aria-hidden />;
  }

  if (post.postType === "IMAGE" || post.postType === "CAROUSEL") {
    return <Image className={className} strokeWidth={stroke} aria-hidden />;
  }

  if (post.postType === "VIDEO") {
    return <Video className={className} strokeWidth={stroke} aria-hidden />;
  }

  return <AlignLeft className={className} strokeWidth={stroke} aria-hidden />;
}
