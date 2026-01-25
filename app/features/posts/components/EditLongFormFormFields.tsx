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
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Title
        </label>
        <input
          id="longform-title"
          name="longform-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="dark:bg-card w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:text-white"
          placeholder="Article title..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-summary"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Summary
        </label>
        <textarea
          id="longform-summary"
          name="longform-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="dark:bg-card w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:text-white"
          placeholder="Article summary..."
        />
      </div>

      <div>
        <label
          htmlFor="longform-editorjs"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Content
        </label>
        <div className="dark:bg-card rounded-md border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600">
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
        <label
          htmlFor="longform-cover-image"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Cover Image URL (optional)
        </label>
        <input
          id="longform-cover-image"
          name="longform-cover-image"
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="dark:bg-card w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:text-white"
          placeholder="https://example.com/image.jpg"
        />
      </div>
    </>
  );
}
