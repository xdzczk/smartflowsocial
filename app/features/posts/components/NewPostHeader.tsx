/**
 * New post page header component
 */

import { Badge } from "~/components/ui/badge";
interface NewPostHeaderProps {
  selectedHashtags: string;
}

export function NewPostHeader({ selectedHashtags }: NewPostHeaderProps) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Create a post
      </h1>

      {selectedHashtags ? (
        <Badge variant="secondary" className="mb-6">
          <svg
            className="hi-solid hi-hashtag mr-1 inline-block size-4 opacity-75"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z"
              clipRule="evenodd"
            />
          </svg>
          {selectedHashtags}
        </Badge>
      ) : null}
    </>
  );
}









