import { useFetcher } from "@remix-run/react";
import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { resizeImage } from "~/features/upload/image-resize";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import {
  signEventFn,
  convertEditorJSToMarkdown,
  convertMarkdownToEditorJS,
} from "~/lib/nostr";

interface EditPostModalProps {
  post: any;
  onClose: () => void;
  onConfirm: () => void;
  user?: any;
  queueTypes?: any[];
  hashTagPresets?: any[];
}

export function EditPostModal({
  post,
  onClose,
  onConfirm,
  user,
  queueTypes = [],
  hashTagPresets = [],
}: EditPostModalProps) {
  const fetcher = useFetcher();
  const [isSigningEvent, setIsSigningEvent] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  // Form fields for regular posts
  const [caption, setCaption] = useState(post?.caption || "");
  const [selectedQueueType, setSelectedQueueType] = useState(
    post?.queueType?.id || "",
  );

  // Form fields for longform posts
  const [title, setTitle] = useState(post?.title || "");
  const [summary, setSummary] = useState(post?.summary || "");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(post?.image || "");

  // Schedule fields
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);

  // Image/media handling
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Hashtag preset handling
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtagPresetTags, setSelectedHashtagPresetTags] =
    useState("");
  const [manualHashtags, setManualHashtags] = useState("");

  // EditorJS state for longform content
  const editorRef = useRef<any>(null);
  const editorInitialized = useRef(false);
  const [editorReady, setEditorReady] = useState(false);

  // Determine if this is a longform post
  const isLongform = post?.title !== undefined;

  // Initialize EditorJS for longform posts
  useEffect(() => {
    if (!isLongform) return;

    const loadEditor = async () => {
      if (
        typeof window !== "undefined" &&
        !editorRef.current &&
        !editorInitialized.current
      ) {
        editorInitialized.current = true;

        try {
          const EditorJS = (await import("@editorjs/editorjs")).default;

          const editorInstance = new EditorJS({
            holder: "longform-editorjs",
            minHeight: 300,
            tools: {
              header: {
                class: (await import("@editorjs/header")).default,
                config: {
                  placeholder: "Enter a header",
                  levels: [2, 3, 4],
                  defaultLevel: 3,
                },
              },
              list: {
                class: (await import("@editorjs/list")).default,
                inlineToolbar: true,
              },
              quote: {
                class: (await import("@editorjs/quote")).default,
                inlineToolbar: true,
                config: {
                  quotePlaceholder: "Enter a quote",
                  captionPlaceholder: "Quote's author",
                },
              },
              code: {
                class: (await import("@editorjs/code")).default,
                config: {
                  placeholder: "Enter code here...",
                },
              },
              inlineCode: {
                class: (await import("@editorjs/inline-code")).default,
              },
              linkTool: {
                class: (await import("@editorjs/link")).default,
                config: {
                  endpoint: "/api/link-preview",
                },
              },
              embed: {
                class: (await import("@editorjs/embed")).default,
                config: {
                  services: {
                    youtube: true,
                    twitter: true,
                  },
                },
              },
              image: {
                class: (await import("@editorjs/image")).default,
                config: {
                  buttonContent: "Select Image",
                  captionPlaceholder: "",
                  withBorder: false,
                  withBackground: false,
                  stretched: false,
                  uploader: {
                    uploadByFile: async (file: File) => {
                      try {
                        const formData = new FormData();
                        formData.append("image", file);

                        const response = await fetch(
                          "/api/upload-editorjs-image",
                          {
                            method: "POST",
                            body: formData,
                          },
                        );

                        if (!response.ok) {
                          throw new Error(`Server error: ${response.status}`);
                        }

                        const result = await response.json();

                        if (result.success === 1 && result.file?.url) {
                          return {
                            success: 1,
                            file: {
                              url: result.file.url,
                            },
                          };
                        } else {
                          throw new Error(result.error || "Upload failed");
                        }
                      } catch (error) {
                        const { handleAsyncError } = await import("~/lib/error-handler.client");
                        handleAsyncError(error, {
                          component: "EditPostModal",
                          action: "uploadImage",
                        }, false); // Don't show toast, let EditorJS handle it
                        throw error;
                      }
                    },
                  },
                },
              },
            },
            onChange: async (api) => {
              try {
                const outputData = await api.saver.save();
                const markdownContent = convertEditorJSToMarkdown(outputData);
                setContent(markdownContent);
              } catch (error) {
                console.error("Editor save error:", error);
              }
            },
          });

          editorRef.current = editorInstance;

          // Wait for editor to be ready
          await editorRef.current.isReady;
          setEditorReady(true);
        } catch (error) {
          console.error("Error loading EditorJS:", error);
          editorInitialized.current = false;
        }
      }
    };

    loadEditor();

    return () => {
      if (editorRef.current) {
        try {
          if (editorRef.current.destroy) {
            editorRef.current.destroy();
          }
        } catch (error) {
          console.warn("Error during editor cleanup:", error);
        } finally {
          editorRef.current = null;
          editorInitialized.current = false;
          setEditorReady(false);
        }
      }
    };
  }, [isLongform]);

  useEffect(() => {
    if (post) {
      if (isLongform) {
        setTitle(post.title || "");
        setSummary(post.summary || "");
        setImage(post.image || "");
        // Set content as markdown for EditorJS to load later
        setContent(post.content || "");
        setScheduledFor(post.publishedAt ? new Date(post.publishedAt) : null);
      } else {
        // Initialize regular post fields
        setCaption(post.caption || "");
        setSelectedQueueType(post.queueType?.id || "");
        setScheduledFor(
          post.scheduledFor
            ? new Date(parseInt(post.scheduledFor) * 1000)
            : null,
        );

        // Parse existing images
        if (post.fileUrl && Array.isArray(post.fileUrl)) {
          const urls = post.fileUrl
            .map((url) => {
              if (typeof url === "string" && url.startsWith("[")) {
                try {
                  const parsed = JSON.parse(url);
                  return Array.isArray(parsed) ? parsed : [url];
                } catch {
                  return [url];
                }
              }
              return Array.isArray(url) ? url : [url];
            })
            .flat();
          setExistingImages(
            urls.filter((url) => typeof url === "string" && url.length > 0),
          );
        }

        // Parse existing hashtags
        const existingHashtags = post.hashtags || "";
        if (existingHashtags) {
          setManualHashtags(existingHashtags);
        }

        // Check if post uses hashtag preset
        if (post.hashTagPresetId && hashTagPresets.length > 0) {
          const preset = hashTagPresets.find(
            (p) => p.id === post.hashTagPresetId,
          );
          if (preset) {
            setUseHashtagPresets(true);
            setSelectedHashtagPresetId(preset.id);
            setSelectedHashtagPresetTags(preset.tags || "");
          }
        }
      }
    }
  }, [post, isLongform, hashTagPresets]);

  // Load initial content into EditorJS for longform posts
  useEffect(() => {
    if (!isLongform || !editorReady || !editorRef.current || !content) return;

    const loadInitialContent = async () => {
      try {
        await editorRef.current.isReady;

        // Convert markdown content to EditorJS format
        const editorJSData = convertMarkdownToEditorJS(content);

        await editorRef.current.render(editorJSData);
      } catch (error) {
        console.error("Error loading initial content into EditorJS:", error);
      }
    };

    // Add a small delay to ensure everything is settled
    const timeoutId = setTimeout(loadInitialContent, 100);
    return () => clearTimeout(timeoutId);
  }, [isLongform, editorReady, content]);

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.needsSigning) {
        return; // Keep modal open for re-signing
      }
      onConfirm();
    }
    if (fetcher.data?.error) {
      setSigningError(fetcher.data.error);
    }
  }, [fetcher.data, onConfirm]);

  const formatDateTimeForInput = (date: Date) => {
    const userTimezone = user?.timezone || "UTC";
    const dateInUserTz = new Date(
      date.toLocaleString("en-US", { timeZone: userTimezone }),
    );
    const year = dateInUserTz.getFullYear();
    const month = String(dateInUserTz.getMonth() + 1).padStart(2, "0");
    const day = String(dateInUserTz.getDate()).padStart(2, "0");
    const hours = String(dateInUserTz.getHours()).padStart(2, "0");
    const minutes = String(dateInUserTz.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          if (file.type.startsWith("image/")) {
            return await resizeImage(file);
          }
          return file;
        }),
      );
      setNewFiles((prev) => [...prev, ...processedFiles]);
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Error processing files");
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string,
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtagPresetTags(hashtags);
  };

  const handleSubmit = async () => {
    if (!post) return;

    try {
      setIsSigningEvent(true);
      setSigningError(null);

      // Handle image uploads first if there are new files
      const allImageUrls = [...existingImages];
      if (newFiles.length > 0) {
        setIsUploadingImages(true);
        try {
          const uploadResults = await uploadMultipleFiles(newFiles);
          const failedUploads = uploadResults.filter(
            (result) => !result.success,
          );
          if (failedUploads.length > 0) {
            throw new Error(
              `Upload failed: ${failedUploads.map((r) => r.error).join(", ")}`,
            );
          }
          const newUrls = uploadResults
            .filter((result) => result.success && result.file)
            .map((result) => result.file!.url);
          allImageUrls.push(...newUrls);
        } catch (uploadError) {
          setIsSigningEvent(false);
          setIsUploadingImages(false);
          throw uploadError;
        }
        setIsUploadingImages(false);
      }

      let eventContent = "";
      let eventTags: string[][] = [];
      let finalHashtags = "";

      if (isLongform) {
        // Create longform event content (NIP-23)
        eventContent = content;
        eventTags = [
          ["d", post.id], // identifier tag
          ["title", title],
          ["summary", summary],
        ];
        if (image) {
          eventTags.push(["image", image]);
        }
      } else {
        // Determine final hashtags to use
        if (useHashtagPresets && selectedHashtagPresetTags) {
          finalHashtags = selectedHashtagPresetTags;
        } else {
          finalHashtags = manualHashtags;
        }

        // Create post content with images below text
        eventContent = caption;

        // Add image URLs to content (below the text)
        if (allImageUrls.length > 0) {
          const imageContent = allImageUrls.join("\n");
          eventContent = eventContent
            ? `${eventContent}\n\n${imageContent}`
            : imageContent;
        }

        // Add hashtags if applicable and user setting is enabled
        if (user?.showHashTagsinPosts && finalHashtags) {
          eventContent = `${eventContent}\n${finalHashtags}`;
        }

        // Parse hashtags and add as 't' tags
        if (finalHashtags) {
          const hashtagList = finalHashtags
            .split(/\s+/)
            .filter((tag) => tag.startsWith("#") && tag.length > 1);
          hashtagList.forEach((tag) => {
            eventTags.push(["t", tag.replace("#", "")]);
          });
        }
      }

      const eventKind = isLongform ? 30023 : 1;
      const eventTime = scheduledFor
        ? Math.floor(scheduledFor.getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      // Re-sign the event with new content
      const { nostrEvent, signedEvent } = await signEventFn({
        content: eventContent,
        created_at: eventTime,
        kind: eventKind,
        tags: eventTags,
      });

      // Submit the edit action with signed event
      const formData = new FormData();
      formData.append("_action", isLongform ? "editLongform" : "editPost");
      formData.append("postId", post.id);
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));

      if (scheduledFor) {
        formData.append(
          "scheduledFor",
          Math.floor(scheduledFor.getTime() / 1000).toString(),
        );
      }

      if (isLongform) {
        formData.append("title", title);
        formData.append("summary", summary);
        formData.append("content", content);
        formData.append("image", image);
      } else {
        formData.append("caption", caption);
        formData.append("fileUrl", JSON.stringify(allImageUrls));
        formData.append("hashtags", finalHashtags);
        if (selectedQueueType) {
          formData.append("queueTypeId", selectedQueueType);
        }
        if (useHashtagPresets && selectedHashtagPresetId) {
          formData.append("hashTagPresetId", selectedHashtagPresetId);
        }
      }

      fetcher.submit(formData, { method: "post" });
    } catch (error: any) {
      console.error("Error re-signing event:", error);
      setIsSigningEvent(false);
      setSigningError(
        error.message || "Failed to sign event. Please try again.",
      );
    }
  };

  if (!post) return null;

  return (
    <>
      {/* EditorJS Custom Styles */}
      {isLongform ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            #longform-editorjs {
              font-family: inherit;
            }
            
            .ce-block {
              padding: 0.5rem 0;
            }
            
            .ce-block__content {
              max-width: none !important;
            }
            
            .ce-toolbar__actions {
              right: -30px;
            }
            
            .ce-toolbar__plus {
              background: #374151 !important;
              color: white !important;
            }
            
            .ce-toolbar__plus:hover {
              background: #1f2937 !important;
            }
            
            .ce-block--selected {
              background: rgba(59, 130, 246, 0.1) !important;
              border-radius: 0.375rem;
            }
            
            .image-tool {
              margin: 1rem 0;
            }
            
            .image-tool__image {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            }
            
            /* Remove image captions */
            .image-tool__caption,
            .image-tool__caption[contenteditable="true"],
            .image-tool__caption[contenteditable="false"],
            .image-tool .cdx-input {
              display: none !important;
              visibility: hidden !important;
            }
          `,
          }}
        />
      ) : null}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit {isLongform ? "Article" : "Post"}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {isLongform ? (
                /* Longform fields */
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="Article title..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Summary
                    </label>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="Article summary..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Content
                    </label>
                    <div className="rounded-md border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800">
                      <div className="min-h-[300px] p-4">
                        <div
                          id="longform-editorjs"
                          className="prose prose-lg dark:prose-invert min-h-[260px] max-w-none"
                        ></div>
                      </div>
                    </div>
                    {!editorReady ? (
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Loading editor...
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cover Image URL (optional)
                    </label>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </>
              ) : (
                /* Regular post fields with images & hashtag presets */
                <>
                  {/* Images section */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Images / Media
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {existingImages.map((url, idx) => (
                        <div key={`existing-${idx}`} className="relative">
                          <img
                            src={url}
                            alt="Existing"
                            className="h-24 w-24 rounded object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(idx)}
                            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {newFiles.map((file, idx) => {
                        const objectURL = URL.createObjectURL(file);
                        return (
                          <div key={`new-${idx}`} className="relative">
                            <img
                              src={objectURL}
                              alt="New"
                              className="h-24 w-24 rounded object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeNewFile(idx)}
                              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 hover:border-gray-400">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,video/*"
                          multiple
                          onChange={handleFileChange}
                        />
                        <span className="text-3xl text-gray-500">+</span>
                      </label>
                    </div>
                  </div>

                  {/* Caption */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Caption
                    </label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      placeholder="What's on your mind?"
                    />
                  </div>

                  {/* Hashtag Preset Toggle */}
                  <HashtagPresetToggle
                    presets={hashTagPresets}
                    selectedPresetId={selectedHashtagPresetId}
                    onSelect={handleHashtagPresetSelect}
                    useHashtagPresets={useHashtagPresets}
                    onUseHashtagPresetsChange={setUseHashtagPresets}
                  />

                  {/* Manual hashtags fallback */}
                  {!useHashtagPresets ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Hashtags (space-separated, e.g. #nostr #bitcoin)
                      </label>
                      <input
                        type="text"
                        value={manualHashtags}
                        onChange={(e) => setManualHashtags(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        placeholder="#tag1 #tag2 #tag3"
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Queue Type
                    </label>
                    <select
                      value={selectedQueueType}
                      onChange={(e) => setSelectedQueueType(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Manual (No Queue)</option>
                      {queueTypes.map((queueType) => (
                        <option key={queueType.id} value={queueType.id}>
                          {queueType.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Schedule Date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Scheduled For
                </label>
                <input
                  type="datetime-local"
                  value={
                    scheduledFor ? formatDateTimeForInput(scheduledFor) : ""
                  }
                  onChange={(e) =>
                    setScheduledFor(
                      e.target.value ? new Date(e.target.value) : null,
                    )
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Re-signing notice */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-start space-x-2">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Editing this {isLongform ? "article" : "post"} requires
                      re-signing the Nostr event
                    </div>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {fetcher.data?.error || signingError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-sm text-red-800 dark:text-red-200">
                    {fetcher.data?.error || signingError}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  fetcher.state === "submitting" ||
                  isSigningEvent ||
                  isUploadingImages
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploadingImages
                  ? "Uploading Images..."
                  : isSigningEvent
                    ? "Signing Event..."
                    : fetcher.state === "submitting"
                      ? "Saving..."
                      : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
