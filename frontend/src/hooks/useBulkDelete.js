import { useMutation } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { bulkDeleteItems, bulkDeleteTags, bulkErrorDescription } from "@/api/bulkApi"

export function useBulkDelete(onDeleteSettled) {
    return useMutation({
        mutationFn: ({ items }) => items[0]?.type === "tag"
            ? bulkDeleteTags(items)
            : bulkDeleteItems({ items }),
        retry: false,
        onSuccess: ({ deleted, skipped }) => toast.add({
            title: "Bulk deletion completed",
            description: `${deleted} deleted, ${skipped} skipped.`,
            type: "success",
        }),
        onError: (error, { items }) => toast.add({
            title: "Bulk deletion failed",
            description: bulkErrorDescription(error, items.length, "deleted", "deletions"),
            type: "error",
        }),
        onSettled: (result, error, { items }) => {
            // A resolved deletion target is unavailable, whether deleted or already missing.
            const completedItems = error ? error.completedItems ?? [] : result?.completedItems ?? items
            return onDeleteSettled?.(completedItems)
        },
    })
}
