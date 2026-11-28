import { bulkUnlinkTags } from "@/api/bulkApi"
import { useBulkMutation } from "@/hooks/useBulkMutation"
import { bulkTagFeedback } from "@/lib/bulkFeedback"

export function useBulkUnlinkTags() {
    return useBulkMutation({
        mutationFn: bulkUnlinkTags,
        feedback: result => bulkTagFeedback(result, "cleared"),
        errorTitle: "Could not clear tags",
        changesTags: true,
    })
}
