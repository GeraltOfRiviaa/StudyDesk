import { useMutation } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { bulkDeleteItems } from "@/api/bulkApi"
import { deleteItem } from "@/api/deleteItem"

async function bulkDeleteTags(items) {
    const results = await Promise.allSettled(items.map(deleteItem))
    const deletedItems = results.filter(result => result.status === "fulfilled").map(result => result.value)
    return { deleted: deletedItems.length, failed: results.length - deletedItems.length, deletedItems }
}

export function useBulkDelete(onDeleteSettled) {
    return useMutation({
        mutationFn: ({ items }) => items[0]?.type === "tag"
            ? bulkDeleteTags(items)
            : bulkDeleteItems({ items }),
        retry: false,
        onSuccess: ({ deleted, skipped, failed }) => toast.add({
            title: "Bulk deletion completed",
            description: failed === undefined
                ? `${deleted} deleted, ${skipped} skipped.`
                : `Deleted: ${deleted}, Failed: ${failed}`,
            type: failed > 0 ? "error" : "success",
        }),
        onError: error => toast.add({
            title: "Bulk deletion failed",
            description: error.deleted
                ? `${error.message} Confirmed deletions: ${error.deleted}.`
                : error.message,
            type: "error",
        }),
        onSettled: (result, error, { items }) => {
            // A failed batch may have applied changes. Refresh even when it stays selected for retry.
            const completed = error ? (error.completed ?? 0) : items.length
            const completedItems = items.slice(0, completed)
            // In Items mode a completed batch accounts for every ID, including already missing rows.
            // Tag deletion reports each fulfilled request because some tags may still exist.
            return onDeleteSettled?.(completedItems, result?.deletedItems ?? completedItems)
        },
    })
}
