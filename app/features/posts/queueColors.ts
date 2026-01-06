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
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-800 dark:text-blue-200",
      hover: "hover:bg-blue-200 dark:hover:bg-blue-900/50",
      border: "border-blue-300 dark:border-blue-600",
    },
    memes: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-800 dark:text-green-200",
      hover: "hover:bg-green-200 dark:hover:bg-green-900/50",
      border: "border-green-300 dark:border-green-600",
    },
    quotes: {
      bg: "bg-purple-100 dark:bg-purple-900/30",
      text: "text-purple-800 dark:text-purple-200",
      hover: "hover:bg-purple-200 dark:hover:bg-purple-900/50",
      border: "border-purple-300 dark:border-purple-600",
    },
    unassigned: {
      bg: "bg-gray-100 dark:bg-gray-700",
      text: "text-gray-800 dark:text-gray-200",
      hover: "hover:bg-gray-200 dark:hover:bg-gray-600",
      border: "border-gray-300 dark:border-gray-600",
    },
  };

  // Return default color if queue type not found
  return colorMap[queueType?.toLowerCase()] ?? colorMap["unassigned"];
};

export const getSelectedQueueStyle = (
  queueType: string,
  isSelected: boolean
) => {
  const colors = getQueueColor(queueType);
  // getQueueColor always returns a value (has fallback to "unassigned")
  const safeColors = colors ?? getQueueColor("unassigned");
  if (!safeColors) {
    // This should never happen, but TypeScript needs this check
    return "";
  }

  if (isSelected) {
    return `${safeColors.bg} ${safeColors.text} ${safeColors.border} border-2 shadow-md transform scale-105`;
  }

  return `${safeColors.bg} ${safeColors.text} ${safeColors.hover} ${safeColors.border} border opacity-70 hover:opacity-100 hover:shadow-sm`;
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
