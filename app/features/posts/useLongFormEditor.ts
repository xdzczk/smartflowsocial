/**
 * Tiptap-based longform editor hook.
 * Replaces EditorJS: syncs markdown to form via debounced onUpdate and flushSync.
 */

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { generateSummaryFromMarkdown } from "~/lib/markdown-utils";

import { htmlToMarkdown } from "./utils/html-to-markdown.client";

const DEBOUNCE_MS = 500;

interface UseLongFormEditorOptions {
  uploadProvider: string | null;
  initialMarkdown?: string;
  onContentChange: (markdown: string) => void;
}

export function useLongFormEditor({
  uploadProvider: _uploadProvider,
  initialMarkdown = "",
  onContentChange,
}: UseLongFormEditorOptions) {
  const [mounted, setMounted] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorInstanceRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const onContentChangeRef = useRef(onContentChange);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  /** StarterKit v3 already includes Link; do not register Link twice (breaks link/mark commands at runtime). */
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: {
          openOnClick: false,
        },
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: false,
          pedantic: false,
          smartLists: true,
          smartypants: false,
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing your article…",
      }),
      Image,
    ],
    []
  );

  const editor = useEditor(
    mounted
      ? {
          extensions,
          content: initialMarkdown,
          contentType: "markdown",
          immediatelyRender: false,
          onUpdate: ({ editor: ed }) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              debounceRef.current = null;
              const md =
                "getMarkdown" in ed && typeof ed.getMarkdown === "function"
                  ? ed.getMarkdown()
                  : "";
              onContentChangeRef.current(md);
            }, DEBOUNCE_MS);
          },
          onPaste: (event) => {
            void (async () => {
              const ed = editorInstanceRef.current;
              if (!ed) return;
              const html = event.clipboardData?.getData("text/html");
              if (html?.trim()) {
                event.preventDefault();
                const markdown = await htmlToMarkdown(html);
                if (markdown) {
                  ed.chain()
                    .focus()
                    .insertContent(markdown, { contentType: "markdown" })
                    .run();
                }
              }
            })();
          },
          onCreate: ({ editor: ed }) => {
            editorInstanceRef.current = ed;
            setEditorReady(true);
          },
        }
      : {
          immediatelyRender: false,
          extensions,
        },
    [mounted, initialMarkdown, extensions]
  );

  const flushSync = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (
      editor &&
      "getMarkdown" in editor &&
      typeof editor.getMarkdown === "function"
    ) {
      onContentChangeRef.current(editor.getMarkdown());
    }
  }, [editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      flushSync();
    };
  }, [flushSync]);

  const loadInitialData = useCallback(
    (markdown: string) => {
      if (!editor || !markdown.trim()) return;
      editor.commands.setContent(markdown, { contentType: "markdown" });
      const md =
        "getMarkdown" in editor && typeof editor.getMarkdown === "function"
          ? editor.getMarkdown()
          : "";
      onContentChangeRef.current(md);
    },
    [editor]
  );

  const insertAssetIntoEditor = useCallback(
    (
      selectedAssets: Array<{
        assetType: string;
        fileUrl?: string;
        content?: string;
        title?: string;
      }>
    ) => {
      if (!editor) return;
      for (const asset of selectedAssets) {
        if (asset.assetType === "IMAGE" && asset.fileUrl) {
          editor.chain().focus().setImage({ src: asset.fileUrl }).run();
        } else if (asset.assetType === "TEXT") {
          const text = asset.content ?? asset.title ?? "";
          if (text) {
            editor.chain().focus().insertContent(text).run();
          }
        }
      }
      const md =
        "getMarkdown" in editor && typeof editor.getMarkdown === "function"
          ? editor.getMarkdown()
          : "";
      onContentChangeRef.current(md);
    },
    [editor]
  );

  const generateSummaryFromContent = useCallback((markdown: string) => {
    return generateSummaryFromMarkdown(markdown);
  }, []);

  return {
    editor,
    editorReady,
    loadInitialData,
    insertAssetIntoEditor,
    generateSummaryFromContent,
    flushSync,
  };
}
