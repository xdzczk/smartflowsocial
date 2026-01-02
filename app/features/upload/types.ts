/**
 * Upload Types
 * Shared TypeScript interfaces for file upload features
 */

/**
 * Upload provider configuration
 */
export interface UploadProvider {
  type: "blossom" | "s3";
  endpoint?: string;
}

/**
 * Options for submitting uploads
 */
export interface SubmitOptions {
  provider: UploadProvider;
}

/**
 * Result from upload operations
 */
export interface UploadResult {
  url: string;
  sha256?: string;
  size?: number;
  type?: string;
}

/**
 * Props for BlossomMediaMirrorsSettings component
 */
export interface BlossomMediaMirrorsSettingsProps {
  mirrors: string[];
  onMirrorsChange: (mirrors: string[]) => void;
  isLoading?: boolean;
}

/**
 * Props for UploadProviderSettings component
 */
export interface UploadProviderSettingsProps {
  provider: "blossom" | "s3";
  endpoint?: string;
  onProviderChange: (provider: "blossom" | "s3", endpoint?: string) => void;
}

/**
 * Props for SmartUploadButton component
 */
export interface SmartUploadButtonProps {
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: Error) => void;
  accept?: string;
  maxSize?: number;
  className?: string;
  children?: React.ReactNode;
}
