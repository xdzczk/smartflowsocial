import { ShieldOff } from "lucide-react";

import { EmptyState } from "~/components/ui/empty-state";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

/** Non-admin viewers hitting admin routes (loader still returns a shell). */
export function AdminAccessDenied() {
  return (
    <div className="px-4 py-8 sm:px-6">
      <EmptyState
        size="md"
        icon={<ShieldOff strokeWidth={INLINE_ICON_STROKE} />}
        title="Access denied"
        description="You do not have permission to view this admin area."
        className="border-border bg-surface rounded-xl border"
      />
    </div>
  );
}
