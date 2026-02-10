import { useFetcher, useLocation } from "@remix-run/react";
import { useState } from "react";

import type { ScheduleData, TemplateFetcher, Template } from "../types";

/**
 * Custom hook for managing templates state and operations
 */
export function useTemplatesState() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  const location = useLocation();
  const deleteFetcher = useFetcher();
  const scheduleFetcher: TemplateFetcher = useFetcher<{
    scheduleData?: ScheduleData[];
  }>();

  // Check if we're on a child route (edit page)
  const isOnChildRoute = location.pathname.includes("/edit/");

  return {
    selectedTemplate,
    isOnChildRoute,
    deleteFetcher,
    scheduleFetcher,
    setSelectedTemplate,
  };
}
