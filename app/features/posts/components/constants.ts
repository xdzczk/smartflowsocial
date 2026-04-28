/** Breakpoint (px) below which content listing shows vertical card list instead of table. Match FlowView / QueueSelectionTabs. */
export const CONTENT_MOBILE_BREAKPOINT_PX = 768;

/**
 * Visible keyboard focus for underline-style toolbar controls (flat SelectTrigger / compact inputs).
 * Replaces removed outer rings with inset ring + bottom border token.
 */
export const UNDERLINE_FILTER_FOCUS_CLASS =
  "focus-visible:border-b-focus-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset";

/** Mobile-only classes so date inputs and sort dropdown match content type / queue filter triggers (underline style). */
export const MOBILE_FILTER_INPUT_CLASS =
  "max-md:h-7 max-md:border-0 max-md:border-b-2 max-md:border-border max-md:bg-transparent max-md:px-1 max-md:py-1.5 max-md:text-xs max-md:font-medium max-md:shadow-none max-md:focus-visible:border-b-focus-border max-md:focus-visible:ring-2 max-md:focus-visible:ring-focus-ring max-md:focus-visible:ring-inset";

/** Mobile-only classes for SelectTrigger to match content type / queue filter triggers. */
export const MOBILE_FILTER_SELECT_TRIGGER_CLASS =
  "max-md:h-7 max-md:border-0 max-md:border-b-2 max-md:border-transparent max-md:bg-transparent max-md:px-1 max-md:py-1.5 max-md:text-xs max-md:font-medium max-md:shadow-none max-md:focus-visible:border-b-focus-border max-md:focus-visible:ring-2 max-md:focus-visible:ring-focus-ring max-md:focus-visible:ring-inset max-md:[&>svg]:ml-0";

/** Mobile-only label style to match content type / queue filter (same color and size). */
export const MOBILE_FILTER_LABEL_CLASS =
  "max-md:text-xs max-md:font-medium max-md:text-text";

/** Desktop: label style to match content type tabs (text-sm font-medium text-text). */
export const DESKTOP_FILTER_LABEL_CLASS = "md:font-medium md:text-text";

/** Desktop: date input style to match content type / queue filter (underline, same text size, compact height). */
export const DESKTOP_FILTER_INPUT_CLASS =
  "md:h-7 md:border-0 md:border-b-2 md:border-border md:bg-transparent md:text-sm md:font-medium md:shadow-none md:focus-visible:border-b-focus-border md:focus-visible:ring-2 md:focus-visible:ring-focus-ring md:focus-visible:ring-inset";

/** Desktop: SelectTrigger to match content type tabs (same text size). */
export const DESKTOP_FILTER_SELECT_TRIGGER_CLASS = "md:text-sm";

/** Fixed height (px) of each card in mobile list view so text and image cards are uniform. */
export const CONTENT_LIST_CARD_HEIGHT_PX = 98;

/** Vertical gap (px) between cards in mobile list view. */
export const CONTENT_LIST_CARD_GAP_PX = 8;

/** Estimated row height (px) for bulk posts table virtualization. */
export const BULK_TABLE_ROW_ESTIMATE_PX = 220;
