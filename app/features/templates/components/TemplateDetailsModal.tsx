import { formatDate } from "~/lib/helpers";
interface Template {
    id: string;
    name: string;
    text: string | null;
    imageUrl: string | null;
    createdAt: string | Date;
}

interface TemplateDetailsModalProps {
    template: Template;
    onClose: () => void;
}

export function TemplateDetailsModal({
    template,
    onClose,
}: TemplateDetailsModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <svg
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>

                <h2 className="mb-4 text-xl font-bold">{template.name}</h2>

                {template.imageUrl ? (
                    <div className="mb-4">
                        <img
                            src={template.imageUrl}
                            alt={template.name}
                            className="max-h-64 w-full rounded object-cover"
                        />
                    </div>
                ) : null}

                {template.text ? (
                    <div className="mb-4">
                        <h3 className="mb-2 font-semibold">Content</h3>
                        <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                            {template.text}
                        </p>
                    </div>
                ) : null}

                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Created: {formatDate(template.createdAt)}
                </div>
            </div>
        </div>
    );
}
