import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
} from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";

import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";

import {
  validateUpload,
  getS3ContentType,
  MAX_FILE_SIZE,
} from "./validation.server";

const ERROR_UPLOAD_VALIDATION_FAILED = "Upload validation failed";

type UploadStream = AsyncIterable<Uint8Array>;

const uploadStreamToS3 = async (
  stream: UploadStream,
  key: string,
  s3Client: S3Client,
  filename: string,
  contentType?: string
): Promise<string> => {
  // Convert stream to buffer (required for MIME type detection)
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  // Validate upload (MIME type and size)
  const validation = await validateUpload(buffer, filename, contentType);
  if (!validation.valid) {
    throw new Error(validation.error ?? ERROR_UPLOAD_VALIDATION_FAILED);
  }

  // Get normalized content type
  const s3ContentType = getS3ContentType(validation.detectedMimeType!);

  const params = {
    Bucket: env.STORAGE_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: s3ContentType,
    // Server-side encryption
    ServerSideEncryption: "AES256" as const,
    // Explicit ACL - private by default
    ACL: "private" as const,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    // Construct the URL manually since v3 doesn't return Location
    return `https://${String(env.STORAGE_BUCKET ?? "")}.s3.${String(env.STORAGE_REGION ?? "")}.amazonaws.com/${key}`;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      key,
      bucket: env.STORAGE_BUCKET,
      message: "S3 upload error",
    });
    throw error;
  }
};

export function createUploadHandler(userId: string) {
  return composeUploadHandlers(
    async ({ name: _name, filename, contentType, data }) => {
      // Skip if no filename is provided
      if (!filename) {
        return;
      }

      try {
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        const uniqueFilename = `${uuidv4()}.${ext}`;
        const key = `clients/${userId}/${uniqueFilename}`;

        const s3Client = createS3Client();

        return await uploadStreamToS3(
          data,
          key,
          s3Client,
          filename,
          contentType
        );
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          userId,
          filename,
          message: "Upload handler error",
        });
        throw error;
      }
    },
    createMemoryUploadHandler({
      maxPartSize: MAX_FILE_SIZE, // Use same limit as validation
    })
  );
}

// Upload a buffer directly to S3 (useful for processed files)
export async function uploadBufferToS3(
  buffer: Buffer,
  userId: string,
  filename?: string,
  customKey?: string,
  contentType?: string
): Promise<string> {
  // Generate filename if not provided
  let finalFilename: string;
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    finalFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
  } else {
    finalFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
  }

  // Validate upload (MIME type and size)
  const validation = await validateUpload(buffer, finalFilename, contentType);
  if (!validation.valid) {
    throw new Error(validation.error ?? ERROR_UPLOAD_VALIDATION_FAILED);
  }

  // Use custom key or generate default one
  const key = customKey ?? `clients/${userId}/${finalFilename}`;

  try {
    const s3Client = createS3Client();

    // Get normalized content type
    const s3ContentType = getS3ContentType(validation.detectedMimeType!);

    const command = new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: s3ContentType,
      // Server-side encryption
      ServerSideEncryption: "AES256",
      // Explicit ACL - private by default
      ACL: "private",
    });

    await s3Client.send(command);

    // Return the full URL
    const bucket = env.STORAGE_BUCKET ?? "";
    const region = env.STORAGE_REGION ?? "";
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      filename: finalFilename,
      key,
      message: "S3 buffer upload error",
    });
    throw error;
  }
}

// Create S3 client with credentials
export function createS3Client() {
  return new S3Client({
    region: env.STORAGE_REGION!,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY!,
      secretAccessKey: env.STORAGE_SECRET!,
    },
  });
}

// Specialized function for EditorJS image uploads
export async function uploadEditorJSImage(
  buffer: Buffer,
  userId: string,
  filename: string
): Promise<string> {
  try {
    // Validate upload (MIME type and size)
    const validation = await validateUpload(buffer, filename);
    if (!validation.valid) {
      throw new Error(validation.error ?? ERROR_UPLOAD_VALIDATION_FAILED);
    }

    // Generate a unique filename with timestamp and random string
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const uniqueFilename = `editorjs-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const key = `clients/${userId}/editorjs/${uniqueFilename}`;

    const s3Client = createS3Client();

    // Get normalized content type
    const s3ContentType = getS3ContentType(validation.detectedMimeType!);

    const command = new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: s3ContentType,
      // Server-side encryption
      ServerSideEncryption: "AES256",
      // Explicit ACL - private by default
      ACL: "private",
      // Add cache control for better performance
      CacheControl: "public, max-age=31536000",
    });

    await s3Client.send(command);

    // Return the full URL
    const bucket = env.STORAGE_BUCKET ?? "";
    const region = env.STORAGE_REGION ?? "";
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      filename,
      message: "EditorJS S3 upload error",
    });
    throw new Error(
      `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
