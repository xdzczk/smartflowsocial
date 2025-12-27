/**
 * Search input component for posts
 */

interface PostsSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function PostsSearch({ searchTerm, onSearchChange }: PostsSearchProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l text-gray-500">
          <svg
            className="hi-mini hi-magnifying-glass inline-block size-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <input
          type="text"
          id="search"
          name="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
          placeholder="Search posts.."
        />
      </div>
    </div>
  );
}






