import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { useUser } from "@/context/AuthContext"
import { bulkErrorDescription } from "@/api/bulkApi"

export function useBulkMutation({ mutationFn, successMessage, errorTitle, changesTags = false }) {
    const { user } = useUser()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn,
        retry: false,
        onSuccess: result => toast.add({
            title: successMessage(result),
            type: "success",
        }),
        onError: (error, { items }) => toast.add({
            title: errorTitle,
            description: changesTags
                ? bulkErrorDescription(error, items.length, "modified", "modifications")
                : bulkErrorDescription(error, items.length, "deleted", "link removals"),
            type: "error",
        }),
        onSettled: () => {
            // A failed request can follow earlier batches that already changed data.
            const refresh = [
                queryClient.invalidateQueries({ queryKey: ["library", user?.id] }),
            ]

            if (changesTags) {
                refresh.push(queryClient.invalidateQueries({ queryKey: ["tags", user?.id] }))
            }

            return Promise.all(refresh)
        },
    })
}
