/**
 * Longform fields for Edit Post modal.
 * Uses Tiptap editor (markdown); content synced via debounce + flushSync.
 */

import { useEffect, useRef } from "react";

import { FormControl, FormField, FormLabel } from "~/components/ui/form-field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
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
      <FormField id="longform-title">
        <FormLabel>Title</FormLabel>
        <FormControl>
          <Input
            name="longform-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title..."
          />
        </FormControl>
      </FormField>

      <FormField id="longform-summary">
        <FormLabel>Summary</FormLabel>
        <FormControl>
          <Textarea
            name="longform-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Article summary..."
          />
        </FormControl>
      </FormField>

      <FormField id="longform-content">
        <FormLabel>Content</FormLabel>
        <LongFormContentEditor
          uploadProvider={null}
          onOpenAssetBrowser={() => {}}
          showLabel={false}
          editorReady={tiptapReady}
          editor={editor}
        />
        {!editorReady ? (
          <p className="text-text-secondary text-xs">Loading editor...</p>
        ) : null}
      </FormField>

      <FormField id="longform-cover-image">
        <FormLabel>Cover Image URL (optional)</FormLabel>
        <FormControl>
          <Input
            name="longform-cover-image"
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </FormControl>
      </FormField>
    </>
  );
}
