/**
 * Asset Types
 * Shared TypeScript interfaces for asset features
 */

import type { Asset as PrismaAsset, AssetType } from "@prisma/client";
import type { FetcherWithComponents } from "@remix-run/react";

/**
 * Asset data structure
 */
export interface Asset extends Omit<PrismaAsset, "userId"> {
  id: string;
  title?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  tags: string[];
  assetType: AssetType;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Asset fetcher type for Remix
 */
export type AssetFetcher = FetcherWithComponents<{
  success?: boolean;
  error?: string;
  asset?: Asset;
  assets?: Asset[];
}>;

/**
 * Props for AssetBrowser component
 */
export interface AssetBrowserProps {
  assets: Asset[];
  selectedAssets: string[];
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onAssetSelect: (assetId: string) => void;
  onSelectAllAssets: (assets: Asset[]) => void;
  onBulkPostAssets: (assets: Asset[]) => void;
  onBulkDeleteAssets: () => void;
  deleteFetcherState: string;
  deleteFetcherForm: React.ComponentType<{
    method?: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }>;
  onDeleteAsset: (assetId: string) => void;
}
