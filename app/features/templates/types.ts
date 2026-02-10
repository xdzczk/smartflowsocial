/**
 * Template Types
 * Shared TypeScript interfaces for template features
 */

import type { Template as PrismaTemplate } from "@prisma/client";
import type { FetcherWithComponents } from "@remix-run/react";

/**
 * Template data structure
 */
export interface Template extends PrismaTemplate {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

/**
 * Schedule data for template posting
 */
export interface ScheduleData {
  fileUrl: string;
  scheduledFor: number;
  caption: string;
  queueType: string;
  isRecyclable: boolean;
}

/**
 * Template fetcher type for Remix
 */
export type TemplateFetcher = FetcherWithComponents<{
  success?: boolean;
  error?: string;
  scheduleData?: ScheduleData[];
}>;
