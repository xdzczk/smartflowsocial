interface EditLongFormFormFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  summary: string;
  setSummary: (value: string) => void;
  image: string;
  setImage: (value: string) => void;
  editorReady: boolean;
}

export function EditLongFormFormFields({
  title,
  setTitle,
  summary,
  setSummary,
  image,
  setImage,
  editorReady,
}: EditLongFormFormFieldsProps) {
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
          className="dark:bg-card border-border text-foreground dark:border-border w-full rounded-md border bg-white px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:text-white"
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
          className="dark:bg-card border-border text-foreground dark:border-border w-full rounded-md border bg-white px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:text-white"
          placeholder="Article summary..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-editorjs"
          className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
        >
          Content
        </label>
        <div className="dark:bg-card border-border dark:border-border rounded-md border bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <div className="min-h-[300px] p-4">
            <div
              id="longform-editorjs"
              className="prose prose-lg dark:prose-invert min-h-[260px] max-w-none"
            ></div>
          </div>
        </div>
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
          className="dark:bg-card border-border text-foreground dark:border-border w-full rounded-md border bg-white px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:text-white"
          placeholder="https://example.com/image.jpg"
        />
      </div>
    </>
  );
}
