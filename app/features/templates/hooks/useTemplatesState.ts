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

  // Child routes: /edit/:id, /new, /new/post, /new/longform (not the list at /dashboard/templates)
  const isOnChildRoute = location.pathname.startsWith("/dashboard/templates/");

  return {
    selectedTemplate,
    isOnChildRoute,
    deleteFetcher,
    scheduleFetcher,
    setSelectedTemplate,
  };
}
