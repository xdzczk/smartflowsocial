/**
 * Writing Surface (hero) for Long-form Composer v2.
 * Centered column: inline title + body editor. No form-field look.
 * Title uses uncontrolled input (register) so re-renders don't overwrite or freeze typing.
 */

import { useEffect, useRef } from "react";
import type { FieldValues, UseFormRegister } from "react-hook-form";

import { LongFormContentEditor } from "./LongFormContentEditor";

interface WritingSurfaceProps<T extends FieldValues = FieldValues> {
  /** Form register for uncontrolled title input (avoids freeze on re-render) */
  register: UseFormRegister<T>;
  content?: string;
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
}

export function WritingSurface<T extends FieldValues = FieldValues>({
  register,
  content: _content = "",
  uploadProvider,
  onOpenAssetBrowser,
}: WritingSurfaceProps<T>) {
  const titleRef = useRef<HTMLInputElement | null>(null);
  const titleReg = register("title" as Parameters<UseFormRegister<T>>[0]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6">
      <input
        type="text"
        id="title"
        placeholder="Write a title… or don't. You can fix it later."
        className="text-foreground placeholder:text-muted-foreground mb-8 w-full border-0 bg-transparent text-4xl leading-tight font-semibold tracking-tight outline-none focus:ring-0 dark:text-white"
        aria-label="Article title"
        {...titleReg}
        ref={(el) => {
          titleReg.ref(el);
          titleRef.current = el;
        }}
      />
      <LongFormContentEditor
        uploadProvider={uploadProvider}
        onOpenAssetBrowser={onOpenAssetBrowser}
        showLabel={false}
      />
    </div>
  );
}
