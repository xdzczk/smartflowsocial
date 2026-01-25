// Convert hex color to RGB values for Tailwind-compatible styles
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result?.[1] || !result[2] || !result[3]) {
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

// Queue color mapping utility
export const getQueueColor = (
  queueType: string,
  customColor?: string | null
) => {
  // If custom color is provided, generate styles using that color
  if (customColor) {
    const rgb = hexToRgb(customColor);
    if (rgb) {
      return {
        bg: `bg-[${customColor}] bg-opacity-20 dark:bg-opacity-30`,
        text: `text-[${customColor}] dark:text-[${customColor}]`,
        hover: `hover:bg-[${customColor}] hover:bg-opacity-30 dark:hover:bg-opacity-50`,
        border: `border-[${customColor}] dark:border-[${customColor}]`,
      };
    }
  }

  const colorMap: Record<
    string,
    { bg: string; text: string; hover: string; border: string }
  > = {
    main: {
      bg: "bg-primary/20",
      text: "text-primary",
      hover: "hover:bg-primary/30",
      border: "border-primary/30",
    },
    memes: {
      bg: "bg-green-500/20",
      text: "text-green-600 dark:text-green-400",
      hover: "hover:bg-green-500/30",
      border: "border-green-500/30",
    },
    quotes: {
      bg: "bg-accent/30",
      text: "text-accent-foreground",
      hover: "hover:bg-accent/40",
      border: "border-accent/30",
    },
    unassigned: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      hover: "hover:bg-muted/80",
      border: "border-border",
    },
  };

  // Return default color if queue type not found
  return colorMap[queueType.toLowerCase()] ?? colorMap["unassigned"];
};

export const getSelectedQueueStyle = (
  queueType: string,
  isSelected: boolean
) => {
  const colors = getQueueColor(queueType);
  // getQueueColor always returns a value (has fallback to "unassigned")
  if (!colors) {
    // This should never happen, but TypeScript needs this check
    return "";
  }

  if (isSelected) {
    return `${colors.bg} ${colors.text} ${colors.border} border-2 shadow-md transform scale-105`;
  }

  return `${colors.bg} ${colors.text} ${colors.hover} ${colors.border} border opacity-70 hover:opacity-100 hover:shadow-sm`;
};

// Generate dynamic queue style using database color
export const getDynamicQueueStyle = (
  queueColor: string | null,
  isSelected: boolean
) => {
  if (!queueColor) {
    // Fallback to unassigned style
    return getSelectedQueueStyle("unassigned", isSelected);
  }

  const rgb = hexToRgb(queueColor);
  if (!rgb) {
    return getSelectedQueueStyle("unassigned", isSelected);
  }

  const baseStyle = `transition-all duration-200`;

  if (isSelected) {
    return `${baseStyle} border-2 shadow-md transform scale-105 text-white font-medium`;
  }

  return `${baseStyle} border opacity-70 hover:opacity-100 hover:shadow-sm text-white font-medium hover:scale-105`;
};
