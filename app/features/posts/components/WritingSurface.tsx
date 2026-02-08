/**
 * Writing Surface (hero) for Long-form Composer v2.
 * Centered column: inline title + body editor. No form-field look.
 * Title uses uncontrolled input (register) with a stable ref so focus is not lost on re-render.
 */

import { useCallback, useEffect, useRef } from "react";
import type { FieldValues, UseFormRegister } from "react-hook-form";

import { LongFormContentEditor } from "./LongFormContentEditor";

interface WritingSurfaceProps<T extends FieldValues = FieldValues> {
  /** Form register for uncontrolled title input (avoids freeze on re-render) */
  register: UseFormRegister<T>;
  content?: string;
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
  /** When false, editor area blocks pointer events until EditorJS is ready (prevents toolbar error) */
  editorReady?: boolean;
}

export function WritingSurface<T extends FieldValues = FieldValues>({
  register,
  content: _content = "",
  uploadProvider,
  onOpenAssetBrowser,
  editorReady = false,
}: WritingSurfaceProps<T>) {
  const titleReg = register("title" as Parameters<UseFormRegister<T>>[0]);
  const registerRefRef = useRef(titleReg.ref);

  useEffect(() => {
    registerRefRef.current = titleReg.ref;
  }, [titleReg.ref]);

  const stableRef = useCallback((el: HTMLInputElement | null) => {
    registerRefRef.current(el);
  }, []);

  useEffect(() => {
    document.getElementById("title")?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6">
      <input
        type="text"
        id="title"
        placeholder="Write a title… or don't. You can fix it later."
        className="text-foreground placeholder:text-muted-foreground mb-8 w-full border-0 bg-transparent text-4xl leading-tight font-semibold tracking-tight outline-none focus:ring-0 dark:text-white"
        aria-label="Article title"
        name={titleReg.name}
        onChange={(e) => void titleReg.onChange(e)}
        onBlur={(e) => void titleReg.onBlur(e)}
        ref={stableRef}
      />
      <LongFormContentEditor
        uploadProvider={uploadProvider}
        onOpenAssetBrowser={onOpenAssetBrowser}
        showLabel={false}
        editorReady={editorReady}
      />
    </div>
  );
}
