import { bulkSetTags } from "@/api/bulkApi"
import { useBulkMutation } from "@/hooks/useBulkMutation"
import { bulkTagFeedback } from "@/lib/bulkFeedback"

export function useBulkSetTags() {
    return useBulkMutation({
        mutationFn: bulkSetTags,
        feedback: result => bulkTagFeedback(result, "added"),
        errorTitle: "Could not apply tags",
        changesTags: true,
    })
}
