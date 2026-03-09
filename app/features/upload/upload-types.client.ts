/**
 * Client-side upload result types (used by upload.client and provider adapters).
 * For the public UploadResult type see ~/features/upload/types.
 */

export interface UploadResultClient {
  success: boolean;
  file?: {
    url: string;
    size: number;
    name: string;
    extension: string;
    sha256?: string;
    mimeType?: string;
    provider:
      | "S3"
      | "BLOSSOM_PRIMAL"
      | "BLOSSOM_BLOSSTR"
      | "BLOSSOM_SFS"
      | "BLOSSOM_CUSTOM";
    mirrors?: MirrorUploadResult[];
  };
  error?: string;
}

export interface MirrorUploadResult {
  uploadUrl: string;
  success: boolean;
  url?: string;
  sha256?: string;
  size?: number;
  type?: string;
  provider?: string;
  error?: string;
}
