import {
  EditPostModal,
  type EditPostModalProps,
} from "~/features/posts/components/EditPostModal";

export type EditScheduledPostModalProps = Omit<EditPostModalProps, "variant">;

/** Mini-composer edit surface for scheduled posts (shared across Dashboard, Calendar, Scheduled). */
export function EditScheduledPostModal(props: EditScheduledPostModalProps) {
  return <EditPostModal {...props} variant="scheduledMini" />;
}
