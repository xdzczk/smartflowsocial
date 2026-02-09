import { AlignLeft, FileText, Image, Video } from "lucide-react";

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

  if (post.postType === "IMAGE" || post.postType === "CAROUSEL") {
    return <Image className={className} strokeWidth={stroke} aria-hidden />;
  }

  if (post.postType === "VIDEO") {
    return <Video className={className} strokeWidth={stroke} aria-hidden />;
  }

  return <AlignLeft className={className} strokeWidth={stroke} aria-hidden />;
}
