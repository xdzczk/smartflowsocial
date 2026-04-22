/**
 * Longform fields for Edit Post modal.
 * Uses Tiptap editor (markdown); content synced via debounce + flushSync.
 */

import { useEffect, useRef } from "react";

import { useLongFormEditor } from "~/features/posts/useLongFormEditor";

import { LongFormContentEditor } from "./LongFormContentEditor";

interface EditLongFormFormFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  summary: string;
  setSummary: (value: string) => void;
  content: string;
  onContentChange: (value: string) => void;
  image: string;
  setImage: (value: string) => void;
  editorReady: boolean;
  onEditorReady: (ready: boolean) => void;
  editorApiRef: React.MutableRefObject<{ flushSync: () => void } | null>;
}

export function EditLongFormFormFields({
  title,
  setTitle,
  summary,
  setSummary,
  content,
  onContentChange,
  image,
  setImage,
  editorReady,
  onEditorReady,
  editorApiRef,
}: EditLongFormFormFieldsProps) {
  const {
    editor,
    editorReady: tiptapReady,
    flushSync,
  } = useLongFormEditor({
    uploadProvider: null,
    initialMarkdown: content,
    onContentChange,
  });

  const prevReadyRef = useRef(false);
  useEffect(() => {
    editorApiRef.current = { flushSync };
    return () => {
      editorApiRef.current = null;
    };
  }, [editorApiRef, flushSync]);

  useEffect(() => {
    if (tiptapReady && !prevReadyRef.current) {
      prevReadyRef.current = true;
      onEditorReady(true);
    }
  }, [tiptapReady, onEditorReady]);

  return (
    <>
      <div>
        <label
          htmlFor="longform-title"
          className="text-text-secondary dark:text-text mb-2 block text-sm font-medium"
        >
          Title
        </label>
        <input
          id="longform-title"
          name="longform-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-canvas border-border text-text focus:border-brand focus-visible:ring-focus-ring w-full rounded-md border px-3 py-2 focus-visible:ring-2"
          placeholder="Article title..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-summary"
          className="text-text-secondary dark:text-text mb-2 block text-sm font-medium"
        >
          Summary
        </label>
        <textarea
          id="longform-summary"
          name="longform-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="bg-canvas border-border text-text focus:border-brand focus-visible:ring-focus-ring w-full rounded-md border px-3 py-2 focus-visible:ring-2"
          placeholder="Article summary..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-content"
          className="text-text-secondary dark:text-text mb-2 block text-sm font-medium"
        >
          Content
        </label>
        <LongFormContentEditor
          uploadProvider={null}
          onOpenAssetBrowser={() => {}}
          showLabel={false}
          editorReady={tiptapReady}
          editor={editor}
        />
        {!editorReady ? (
          <div className="text-text-secondary dark:text-text mt-2 text-sm">
            Loading editor...
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="longform-cover-image"
          className="text-text-secondary dark:text-text mb-2 block text-sm font-medium"
        >
          Cover Image URL (optional)
        </label>
        <input
          id="longform-cover-image"
          name="longform-cover-image"
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="bg-canvas border-border text-text focus:border-brand focus-visible:ring-focus-ring w-full rounded-md border px-3 py-2 focus-visible:ring-2"
          placeholder="https://example.com/image.jpg"
        />
      </div>
    </>
  );
}
