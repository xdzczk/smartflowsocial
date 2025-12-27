import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
} from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";

import { logError } from "~/lib/error-logger.server";

type UploadStream = AsyncIterable<Uint8Array>;

const uploadStreamToS3 = async (
  stream: UploadStream,
  key: string,
  s3Client: S3Client,
): Promise<string> => {
  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const buffer = Buffer.concat(chunks);

  const params = {
    Bucket: process.env.STORAGE_BUCKET,
    Key: key,
    Body: buffer,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    // Construct the URL manually since v3 doesn't return Location
    return `https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      key,
      bucket: process.env.STORAGE_BUCKET,
      message: "S3 upload error",
    });
    throw error;
  }
};

export function createUploadHandler(userId: string) {
  return composeUploadHandlers(
    async ({ name, filename, contentType, data }) => {
      // if (name !== "STLFileURL" && name !== "additionalFilesURLs") {
      //   return undefined;
      // }

      // Skip if no filename is provided
      if (!filename) {
        return undefined;
      }

      try {
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        const uniqueFilename = `${uuidv4()}.${ext}`;
        const key = `clients/${userId}/${uniqueFilename}`;

        const s3Client = new S3Client({
          credentials: {
            accessKeyId: process.env.STORAGE_ACCESS_KEY!,
            secretAccessKey: process.env.STORAGE_SECRET!,
          },
          region: process.env.STORAGE_REGION!,
        });

        const uploadedFileLocation = await uploadStreamToS3(
          data,
          key,
          s3Client,
        );

        return uploadedFileLocation;
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
      maxPartSize: 100 * 1024 * 1024,
    }),
  );
}

// Upload a buffer directly to S3 (useful for processed files)
export function uploadBufferToS3(
  buffer: Buffer,
  userId: string,
  filename?: string,
  customKey?: string,
): Promise<string> {
  // Generate filename if not provided
  let finalFilename: string;
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    finalFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
  } else {
    finalFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
  }

  // Use custom key or generate default one
  const key = customKey || `clients/${userId}/${finalFilename}`;

  try {
    const s3Client = createS3Client();

    const command = new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
      Body: buffer,
    });

    await s3Client.send(command);

    // Return the full URL
    const bucket = process.env.STORAGE_BUCKET ?? "";
    const region = process.env.STORAGE_REGION ?? "";
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
    region: process.env.STORAGE_REGION!,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY!,
      secretAccessKey: process.env.STORAGE_SECRET!,
    },
  });
}

// Specialized function for EditorJS image uploads
export function uploadEditorJSImage(
  buffer: Buffer,
  userId: string,
  filename: string,
): Promise<string> {
  try {
    // Generate a unique filename with timestamp and random string
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const uniqueFilename = `editorjs-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const key = `clients/${userId}/editorjs/${uniqueFilename}`;

    const s3Client = createS3Client();

    const command = new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      // Add cache control for better performance
      CacheControl: "public, max-age=31536000",
    });

    await s3Client.send(command);

    // Return the full URL
    const bucket = process.env.STORAGE_BUCKET ?? "";
    const region = process.env.STORAGE_REGION ?? "";
    const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return imageUrl;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      filename,
      message: "EditorJS S3 upload error",
    });
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
  }
}
