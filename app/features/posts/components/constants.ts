/** Breakpoint (px) below which content listing shows vertical card list instead of table. Match FlowView / QueueSelectionTabs. */
export const CONTENT_MOBILE_BREAKPOINT_PX = 768;

/** Mobile-only classes so date inputs and sort dropdown match content type / queue filter triggers (underline style). */
export const MOBILE_FILTER_INPUT_CLASS =
  "max-md:h-8 max-md:border-0 max-md:border-b-2 max-md:border-border max-md:bg-transparent max-md:px-1 max-md:py-1.5 max-md:text-xs max-md:font-medium max-md:shadow-none max-md:focus-visible:ring-0 max-md:focus-visible:ring-offset-0";

/** Mobile-only classes for SelectTrigger to match content type / queue filter triggers. */
export const MOBILE_FILTER_SELECT_TRIGGER_CLASS =
  "max-md:h-8 max-md:border-0 max-md:border-b-2 max-md:border-transparent max-md:bg-transparent max-md:px-1 max-md:py-1.5 max-md:text-xs max-md:font-medium max-md:shadow-none max-md:focus:ring-0 max-md:focus:ring-offset-0 max-md:[&>svg]:ml-0";

/** Mobile-only label style to match content type / queue filter (same color and size). */
export const MOBILE_FILTER_LABEL_CLASS =
  "max-md:text-xs max-md:font-medium max-md:text-foreground";

/** Desktop: label style to match content type tabs (text-sm font-medium text-foreground). */
export const DESKTOP_FILTER_LABEL_CLASS = "md:font-medium md:text-foreground";

/** Desktop: date input style to match content type / queue filter (underline, same text size). */
export const DESKTOP_FILTER_INPUT_CLASS =
  "md:border-0 md:border-b-2 md:border-border md:bg-transparent md:text-sm md:font-medium md:shadow-none md:focus-visible:ring-0 md:focus-visible:ring-offset-0";

/** Desktop: SelectTrigger to match content type tabs (same text size). */
export const DESKTOP_FILTER_SELECT_TRIGGER_CLASS = "md:text-sm";

/** Fixed height (px) of each card in mobile list view so text and image cards are uniform. */
export const CONTENT_LIST_CARD_HEIGHT_PX = 98;

/** Vertical gap (px) between cards in mobile list view. */
export const CONTENT_LIST_CARD_GAP_PX = 8;

/** Estimated row height (px) for bulk posts table virtualization. */
export const BULK_TABLE_ROW_ESTIMATE_PX = 220;
