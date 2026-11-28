import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { useUser } from "@/context/AuthContext"
import { bulkErrorDescription } from "@/api/bulkApi"
import { refreshAccountQueries } from "@/lib/accountQueries"

export function useBulkMutation({ mutationFn, feedback, errorTitle, changesTags = false }) {
    const { session } = useUser()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: variables => mutationFn({ ...variables, signal: session.signal }),
        retry: false,
        onSuccess: result => { if (!session.signal.aborted) toast.add(feedback(result)) },
        onError: (error, { items }) => {
            if (session.signal.aborted) return
            toast.add({
                title: errorTitle,
                description: changesTags
                    ? bulkErrorDescription(error, items.length, "modified", "modifications")
                    : bulkErrorDescription(error, items.length, "deleted", "link removals"),
                type: "error",
            })
        },
        onSettled: () => {
            // A failed request can follow earlier batches that already changed data.
            return refreshAccountQueries(queryClient, session, { tags: changesTags })
        },
    })
}
