/**
 * EditorJS configuration and tools setup
 */

import { logClientError } from "~/lib/error-handler.client";
export async function createEditorJSToolsConfig(uploadProvider: string | null) {
  const headerModule = await import("@editorjs/header");
  const Header = headerModule.default as unknown as new (config?: {
    placeholder?: string;
    levels?: number[];
  }) => unknown;
  const listModule = await import("@editorjs/list");
  const List = listModule.default as unknown as new () => unknown;
  const quoteModule = await import("@editorjs/quote");
  const Quote = quoteModule.default as unknown as new () => unknown;
  const codeModule = await import("@editorjs/code");
  const Code = codeModule.default as unknown as new () => unknown;
  const inlineCodeModule = await import("@editorjs/inline-code");
  const InlineCode = inlineCodeModule.default as unknown as new () => unknown;
  const linkToolModule = await import("@editorjs/link");
  const LinkTool = linkToolModule.default as unknown as new (config?: {
    endpoint: string;
  }) => unknown;
  const embedModule = (await import("@editorjs/embed")) as { default: unknown };
  const Embed = embedModule.default as new (config?: {
    services?: Record<string, boolean>;
  }) => unknown;
  const imageToolModule = (await import("@editorjs/image")) as {
    default: unknown;
  };
  const ImageTool = imageToolModule.default as new (config?: {
    uploader?: {
      uploadByFile: (
        file: File
      ) => Promise<{ success: number; file: { url: string } }>;
    };
  }) => unknown;

  return {
    header: {
      class: Header as unknown as new (config?: {
        placeholder?: string;
        levels?: number[];
        defaultLevel?: number;
      }) => unknown,
      config: {
        placeholder: "Enter a header",
        levels: [2, 3, 4],
        defaultLevel: 3,
      },
    },
    list: {
      class: List,
      inlineToolbar: true,
    },
    quote: {
      class: Quote,
      inlineToolbar: true,
      config: {
        quotePlaceholder: "Enter a quote",
        captionPlaceholder: "Quote's author",
      },
    },
    code: {
      class: Code,
      config: {
        placeholder: "Enter code here...",
      },
    },
    inlineCode: {
      class: InlineCode,
    },
    linkTool: {
      class: LinkTool,
      config: {
        endpoint: "/api/link-preview",
      },
    },
    embed: {
      class: Embed,
      config: {
        services: {
          youtube: true,
          twitter: true,
        },
      },
    },
    image: {
      class: ImageTool,
      config: {
        buttonContent: "Select Image",
        captionPlaceholder: "",
        withBorder: false,
        withBackground: false,
        stretched: false,
        uploader: {
          uploadByUrl: (url: string) => {
            // Handle direct URL uploads (for assets)
            return Promise.resolve({
              success: 1,
              file: {
                url: url,
              },
            });
          },
          uploadByFile: await createImageUploadHandler(uploadProvider),
        },
      },
    },
  };
}

async function createImageUploadHandler(uploadProvider: string | null) {
  return async (file: File) => {
    try {
      logClientError(
        "Starting EditorJS image upload",
        {
          component: "createImageUploadHandler",
          action: "uploadImage",
          fileName: file.name,
          fileSize: file.size,
          uploadProvider,
        },
        "info"
      );

      // Check upload provider and use appropriate method
      if (uploadProvider?.includes("BLOSSOM")) {
        // Use client-side upload for Blossom
        const { uploadFile } = await import("~/features/upload/upload.client");
        const uploadResult = await uploadFile(file);

        if (uploadResult.success && uploadResult.file) {
          logClientError(
            "Blossom upload successful",
            {
              component: "createImageUploadHandler",
              action: "uploadImage",
              provider: "Blossom",
              fileUrl: uploadResult.file.url,
            },
            "info"
          );
          return {
            success: 1,
            file: {
              url: uploadResult.file.url,
              size: uploadResult.file.size || file.size,
              name: uploadResult.file.name || file.name,
              extension:
                uploadResult.file.extension || file.name.split(".").pop(),
            },
          };
        } else {
          const { logClientError } = await import("~/lib/error-handler.client");
          logClientError(
            new Error(uploadResult.error ?? "Blossom upload failed"),
            {
              component: "useLongFormEditor",
              action: "uploadImage",
              provider: "Blossom",
            },
            "warning"
          );
          throw new Error(uploadResult.error ?? "Blossom upload failed");
        }
      } else {
        // Use server-side upload for S3
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch("/api/upload-editorjs-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const { logClientError } = await import("~/lib/error-handler.client");
          logClientError(
            new Error(`Server error: ${response.status}`),
            {
              component: "useLongFormEditor",
              action: "uploadImage",
              provider: "S3",
              serverResponse: errorText,
            },
            "error"
          );
          throw new Error(`Server error: ${response.status}`);
        }

        const result = (await response.json()) as {
          success?: number;
          file?: {
            url?: string;
            size?: number;
            name?: string;
            extension?: string;
          };
          error?: string;
        };
        logClientError(
          "S3 EditorJS upload response",
          {
            component: "createImageUploadHandler",
            action: "uploadImage",
            provider: "S3",
            response: result,
          },
          "info"
        );

        if (result.success === 1 && result.file?.url) {
          logClientError(
            "S3 upload successful",
            {
              component: "createImageUploadHandler",
              action: "uploadImage",
              provider: "S3",
              fileUrl: result.file.url,
            },
            "info"
          );
          return {
            success: 1,
            file: {
              url: result.file.url,
              size: result.file.size ?? file.size,
              name: result.file.name ?? file.name,
              extension: result.file.extension ?? file.name.split(".").pop(),
            },
          };
        } else {
          const { logClientError } = await import("~/lib/error-handler.client");
          logClientError(
            new Error(result.error ?? "Upload failed"),
            {
              component: "useLongFormEditor",
              action: "uploadImage",
              provider: "S3",
            },
            "warning"
          );
          throw new Error(result.error ?? "Upload failed");
        }
      }
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useLongFormEditor",
          action: "uploadImage",
        },
        false
      ); // Don't show toast, let EditorJS handle it
      throw error;
    }
  };
}
