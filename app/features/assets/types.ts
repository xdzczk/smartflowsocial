/**
 * Asset Types
 * Shared TypeScript interfaces for asset management
 */

/**
 * Asset data for asset browser
 */
export interface Asset {
    id: string;
    url: string;
    filename: string;
    size: number;
    type: string;
    createdAt: Date;
}

/**
 * Props for AssetBrowser component
 */
export interface AssetBrowserProps {
    onAssetSelect: (url: string) => void;
    isOpen: boolean;
    onClose: () => void;
}
