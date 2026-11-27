import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { useUser } from "@/context/AuthContext"

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
        onError: (error, { items }) => {
            const progress = error.completed
                ? ` ${error.completed} of ${items.length} selected items were processed before the error.`
                : ""

            toast.add({
                title: errorTitle,
                description: error.message + progress,
                type: "error",
            })
        },
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
