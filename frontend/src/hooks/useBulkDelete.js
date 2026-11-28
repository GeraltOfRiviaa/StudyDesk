import { useMutation } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { bulkDeleteItems } from "@/api/bulkApi"
import { deleteItem } from "@/api/deleteItem"

async function bulkDeleteTags(items) {
    const results = await Promise.allSettled(items.map(deleteItem))
    const deleted = results.filter(result => result.status === "fulfilled").length
    return { deleted, failed: results.length - deleted }
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
        onSettled: (_result, error, { items }) => {
            // A failed batch may have applied changes. Refresh even when it stays selected for retry.
            const completed = error ? (error.completed ?? 0) : items.length
            return onDeleteSettled?.(items.slice(0, completed))
        },
    })
}
