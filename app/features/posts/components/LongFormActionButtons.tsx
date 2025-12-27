import { Button } from "~/components/ui/button";
interface LongFormActionButtonsProps {
    fetcherState: "idle" | "submitting" | "loading";
    isFormValid: boolean;
    hasScheduledFor: boolean;
    onPreview: () => void;
    onSchedule: () => void;
    onPublish: () => void;
}

export function LongFormActionButtons({
    fetcherState,
    isFormValid,
    hasScheduledFor,
    onPreview,
    onSchedule,
    onPublish,
}: LongFormActionButtonsProps) {
    const isDisabled = fetcherState !== "idle" || !isFormValid;

    return (
        <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
            <div className="flex w-full flex-col gap-3 sm:flex-row">
                <Button
                    type="submit"
                    name="_action"
                    value="save-draft"
                    variant="outline"
                    disabled={isDisabled}
                    className="flex-1 border-gray-300 dark:border-gray-600 sm:min-w-[140px] sm:flex-none"
                >
                    {fetcherState !== "idle" ? "Saving..." : "Save Draft"}
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    onClick={onPreview}
                    disabled={!isFormValid}
                    className="flex-1 border-gray-300 dark:border-gray-600 sm:min-w-[140px] sm:flex-none"
                >
                    <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                    </svg>
                    Preview Article
                </Button>

                {hasScheduledFor ? (
                    <Button
                        type="button"
                        onClick={onSchedule}
                        disabled={isDisabled}
                        className="flex-1 bg-blue-600 px-8 font-medium text-white hover:bg-blue-700"
                    >
                        {fetcherState !== "idle"
                            ? "Scheduling..."
                            : "Sign and Schedule"}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={onPublish}
                        disabled={isDisabled}
                        className="flex-1 bg-green-600 px-8 font-medium text-white hover:bg-green-700"
                    >
                        {fetcherState !== "idle" ? "Publishing..." : "Publish Now"}
                    </Button>
                )}
            </div>
        </div>
    );
}
