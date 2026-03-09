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
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Title
        </label>
        <input
          id="longform-title"
          name="longform-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="dark:bg-card border-border text-foreground dark:border-border focus:border-primary focus:ring-ring w-full rounded-md border bg-white px-3 py-2 focus:ring-2 dark:text-white"
          placeholder="Article title..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-summary"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Summary
        </label>
        <textarea
          id="longform-summary"
          name="longform-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="dark:bg-card border-border text-foreground dark:border-border focus:border-primary focus:ring-ring w-full rounded-md border bg-white px-3 py-2 focus:ring-2 dark:text-white"
          placeholder="Article summary..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-content"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
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
          <div className="text-muted-foreground dark:text-foreground mt-2 text-sm">
            Loading editor...
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="longform-cover-image"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Cover Image URL (optional)
        </label>
        <input
          id="longform-cover-image"
          name="longform-cover-image"
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="dark:bg-card border-border text-foreground dark:border-border focus:border-primary focus:ring-ring w-full rounded-md border bg-white px-3 py-2 focus:ring-2 dark:text-white"
          placeholder="https://example.com/image.jpg"
        />
      </div>
    </>
  );
}
