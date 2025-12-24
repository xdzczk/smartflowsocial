import { useState, useCallback } from "react";

interface Asset {
    id: string;
    assetType: string;
    fileUrl?: string;
    content?: string;
    title?: string;
    tags?: string[];
}

interface UseAssetManagementOptions {
    assets: Asset[];
    onBulkDelete: (assetIds: string[]) => void;
    deleteFetcherState: "idle" | "submitting" | "loading";
}

export function useAssetManagement({
    assets,
    onBulkDelete,
    deleteFetcherState,
}: UseAssetManagementOptions) {
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
    const [searchInput, setSearchInput] = useState("");

    const handleAssetSelect = useCallback((assetId: string) => {
        setSelectedAssets((prev) =>
            prev.includes(assetId)
                ? prev.filter((id) => id !== assetId)
                : [...prev, assetId],
        );
    }, []);

    const handleSelectAllAssets = useCallback(() => {
        if (selectedAssets.length === assets.length) {
            setSelectedAssets([]);
        } else {
            setSelectedAssets(assets.map((asset) => asset.id));
        }
    }, [assets, selectedAssets.length]);

    const handleBulkPostAssets = useCallback(() => {
        if (selectedAssets.length === 0) return;

        const selectedAssetData = assets.filter((asset) =>
            selectedAssets.includes(asset.id),
        );

        // Convert assets to repost format
        const assetData = selectedAssetData.map((asset) => ({
            caption: asset.assetType === "TEXT" ? asset.content : asset.title || "",
            fileUrl:
                asset.assetType === "IMAGE" || asset.assetType === "VIDEO"
                    ? asset.fileUrl
                    : null,
            queueType: "unassigned",
            scheduledFor: new Date(Date.now() + 60 * 60 * 1000)
                .toISOString()
                .slice(0, 16), // 1 hour from now
        }));

        // Store in sessionStorage and navigate
        sessionStorage.setItem("repostData", JSON.stringify(assetData));
        window.location.href = "/dashboard/bulkposts?mode=recycle";
    }, [assets, selectedAssets]);

    const handleBulkDeleteAssets = useCallback(() => {
        if (selectedAssets.length === 0) return;

        if (
            !confirm(
                `Are you sure you want to delete ${selectedAssets.length} selected asset${selectedAssets.length > 1 ? "s" : ""}?`,
            )
        ) {
            return;
        }

        onBulkDelete(selectedAssets);

        // Clear selected assets after submission
        setSelectedAssets([]);
    }, [selectedAssets, onBulkDelete]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const url = new URL(window.location.href);
        if (searchInput.trim()) {
            url.searchParams.set("search", searchInput.trim());
        } else {
            url.searchParams.delete("search");
        }
        url.searchParams.delete("page"); // Reset to first page when searching
        window.location.href = url.toString();
    }, [searchInput]);

    const handlePageChange = useCallback((newPage: number) => {
        // Clear selected assets when changing pages
        setSelectedAssets([]);

        const url = new URL(window.location.href);
        if (newPage === 1) {
            url.searchParams.delete("page");
        } else {
            url.searchParams.set("page", newPage.toString());
        }
        window.location.href = url.toString();
    }, []);

    return {
        selectedAssets,
        searchInput,
        setSearchInput,
        handleAssetSelect,
        handleSelectAllAssets,
        handleBulkPostAssets,
        handleBulkDeleteAssets,
        handleSearch,
        handlePageChange,
    };
}
