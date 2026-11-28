import { useMutation } from "@tanstack/react-query"
import { toast } from "@/lib/toast"
import { bulkDeleteItems, bulkDeleteTags, bulkErrorDescription } from "@/api/bulkApi"
import { useUser } from "@/context/AuthContext"
import { bulkDeleteFeedback } from "@/lib/bulkFeedback"

export function useBulkDelete(onDeleteSettled) {
    const { session } = useUser()
    return useMutation({
        mutationFn: ({ items }) => items[0]?.type === "tag"
            ? bulkDeleteTags(items, { signal: session.signal })
            : bulkDeleteItems({ items, signal: session.signal }),
        retry: false,
        onSuccess: result => { if (!session.signal.aborted) toast.add(bulkDeleteFeedback(result)) },
        onError: (error, { items }) => {
            if (session.signal.aborted) return
            toast.add({
                title: "Bulk deletion failed",
                description: bulkErrorDescription(error, items.length, "deleted", "deletions"),
                type: "error",
            })
        },
        onSettled: (result, error, { items }) => {
            if (session.signal.aborted) return
            // A resolved deletion target is unavailable, whether deleted or already missing.
            const completedItems = error ? error.completedItems ?? [] : result?.completedItems ?? items
            return onDeleteSettled?.(completedItems)
        },
    })
}
